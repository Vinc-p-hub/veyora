// Crawler worker: claims queued jobs, fetches/parses, validates, matches, prices, publishes.
// Job locking + crash recovery + exponential backoff retry + source health monitoring.
// Admin-only invocation; meant to be run repeatedly (scheduled task or "Process queue" button).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import {
  canonicalizeUrl, slugify, normalizeTitle, normalizePrice, normalizeCurrency,
  normalizeStock, normalizeBrand, inferCategory,
} from "../../shared/catalog/normalize.js";
import { validateProduct } from "../../shared/catalog/validate.js";
import { matchProduct } from "../../shared/catalog/match.js";
import { premiumScore } from "../../shared/catalog/premium.js";
import { computeCustomerPrice } from "../../shared/commerce/pricing.js";

const BACKOFFS = [60, 300, 900]; // seconds: 1min, 5min, 15min
const STALE_LOCK_MS = 10 * 60 * 1000;
const STALE_OFFER_MS = 24 * 60 * 60 * 1000;

function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const x of arr) {
        if (x && typeof x === "object") {
          const types = Array.isArray(x["@type"]) ? x["@type"] : [x["@type"]];
          if (types.includes("Product")) out.push(x);
        }
      }
    } catch (_e) { /* malformed JSON-LD block — skip */ }
  }
  return out;
}

function jsonLdToRaw(doc, url) {
  const offers = Array.isArray(doc.offers) ? doc.offers[0] : doc.offers;
  const image = Array.isArray(doc.image) ? doc.image[0] : typeof doc.image === "object" && doc.image ? doc.image.url : doc.image;
  const brand = typeof doc.brand === "object" ? doc.brand && (doc.brand.name || doc.brand["@id"]) : doc.brand;
  return {
    title: doc.name,
    brand,
    price: normalizePrice(offers && offers.price),
    currency: normalizeCurrency(offers && offers.priceCurrency),
    url: (offers && offers.url) || url,
    image,
    sku: doc.sku,
    gtin: doc.gtin13 || doc.gtin12 || doc.gtin,
    mpn: doc.mpn,
    model: doc.model,
    category: typeof doc.category === "object" ? undefined : doc.category,
    description: doc.description,
    stock: offers && offers.availability,
  };
}

async function fetchWithTimeout(url, ms) {
  return await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { "user-agent": "VeyroBot/1.0 (+catalog ingestion)" },
  });
}

async function robotsAllows(url) {
  try {
    const u = new URL(url);
    const r = await fetchWithTimeout(`${u.origin}/robots.txt`, 8000);
    if (!r.ok) return true;
    const lines = (await r.text()).split("\n").map((l) => l.trim().toLowerCase());
    let active = false;
    const disallow = [];
    for (const l of lines) {
      if (l.startsWith("user-agent:")) {
        const ua = l.slice(10).trim();
        active = ua === "*" || ua.includes("veyro");
      } else if (active && l.startsWith("disallow:")) {
        const p = l.slice(9).trim();
        if (p) disallow.push(p);
      }
    }
    const path = u.pathname.toLowerCase();
    return !disallow.some((d) => d !== "/" && path.startsWith(d));
  } catch (_e) {
    return true; // robots unreachable — proceed but logged upstream if blocked later
  }
}

function diffUpdate(existing, record) {
  const update = {};
  let changed = false;
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null || v === "") continue;
    const old = existing[k];
    const changedNow = JSON.stringify(old) !== JSON.stringify(v);
    if (changedNow) { update[k] = v; changed = true; }
  }
  return { update, changed };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const maxJobs = Math.min(Number(body.max_jobs) || 10, 25);
    const admin = base44.asServiceRole;
    const now = new Date();

    // --- queue: reclaim stale locks, claim due jobs by priority ---
    const allJobs = await admin.entities.CrawlerJob.list(null, 400);
    const stale = allJobs.filter(
      (j) => j.status === "RUNNING" && j.locked_at && now - new Date(j.locked_at) > STALE_LOCK_MS
    );
    if (stale.length) {
      await admin.entities.CrawlerJob.bulkUpdate(
        stale.map((j) => ({ id: j.id, status: "QUEUED", locked_at: null, locked_by: null }))
      );
    }
    const queued = allJobs
      .filter((j) => j.status === "QUEUED" && (!j.scheduled_at || new Date(j.scheduled_at) <= now))
      .sort((a, b) => (a.priority || 5) - (b.priority || 5));
    const jobs = queued.slice(0, maxJobs);
    if (!jobs.length) {
      return Response.json({ ok: true, processed: 0, completed: 0, failed: 0, retried: 0, note: "Queue empty" });
    }

    const sources = await admin.entities.CrawlerSource.list(null, 200);
    let products = await admin.entities.Product.list("-premium_score", 500);
    let offers = await admin.entities.Offer.list(null, 500);

    const perSource = {};
    const note = (sourceId, ok) => {
      const s = (perSource[sourceId] = perSource[sourceId] || { processed: 0, ok: 0, failed: 0 });
      s.processed++;
      if (ok) s.ok++; else s.failed++;
    };
    let completed = 0;
    let failed = 0;
    let retried = 0;

    for (const job of jobs) {
      await admin.entities.CrawlerJob.update(job.id, {
        status: "RUNNING",
        locked_at: now.toISOString(),
        locked_by: user.id,
        started_at: now.toISOString(),
      });
      const source = sources.find((s) => s.id === job.source_id);
      try {
        if (!source) throw new Error("Source not found");

        // --- fetch / resolve raw product ---
        let raw = job.payload;
        if (!raw || !raw.title) {
          if (!(await robotsAllows(job.url))) throw new Error("Blocked by robots.txt");
          const res = await fetchWithTimeout(job.url, 15000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const docs = extractJsonLd(await res.text());
          if (!docs.length) throw new Error("No JSON-LD product data found");
          raw = jsonLdToRaw(docs[0], job.url);
        }

        // --- normalize ---
        raw.title = normalizeTitle(raw.title);
        raw.price = normalizePrice(raw.price);
        raw.currency = normalizeCurrency(raw.currency) || normalizeCurrency(source.default_currency) || "USD";
        raw.stock_status = normalizeStock(raw.stock);
        raw.brand = normalizeBrand(raw.brand, raw.title);
        raw.category = raw.category || inferCategory(`${raw.title} ${raw.brand || ""}`);
        raw.canonical_url = canonicalizeUrl(raw.url || job.url, source.base_url);
        raw.slug = raw.brand ? slugify(`${raw.brand} ${raw.title}`) : slugify(raw.title);
        if (!raw.url) raw.url = job.url;

        // --- validate (missing optional fields never reject a good product) ---
        const validation = validateProduct(raw);
        const premium = premiumScore({ brand: raw.brand, priceUsd: raw.price, qualityScore: validation.qualityScore });
        const customerPrice = computeCustomerPrice(raw.price);
        const match = matchProduct(raw, products);

        // source health gates automatic publishing
        const sourceHealthy = source.status !== "ERROR" && source.status !== "WARNING";
        let productRecord = null;
        let action = null;

        const record = {
          name: raw.title,
          slug: raw.slug,
          brand: raw.brand,
          category: raw.category || "Accessories",
          source_price: raw.price,
          customer_price: customerPrice,
          currency: raw.currency,
          image_url: raw.image || (job.payload && job.payload.image),
          description: raw.description || "",
          stock_status: raw.stock_status,
          premium_score: premium.score,
          premium_status: premium.status,
          match_confidence: match.confidence,
          data_quality_score: validation.qualityScore,
          source_id: source.id,
          source_name: source.name,
          source_product_id: String(raw.source_product_id || job.payload?.source_product_id || ""),
          source_url: raw.url,
          canonical_url: raw.canonical_url,
          last_crawled_at: now.toISOString(),
          available_countries: source.available_countries || [],
          model: raw.model || undefined,
          sku: raw.sku || undefined,
          gtin: raw.gtin || undefined,
          mpn: raw.mpn || undefined,
        };

        if (match.decision === "AUTO_MATCH" && match.product) {
          const { update, changed } = diffUpdate(match.product, record);
          if (changed) {
            await admin.entities.Product.update(match.product.id, update);
            action = "UPDATED";
          } else {
            action = "UNCHANGED";
          }
          productRecord = match.product;
        } else if (match.decision === "MANUAL_REVIEW" && match.product) {
          await admin.entities.Product.update(match.product.id, {
            status: "REVIEW",
            match_confidence: match.confidence,
            last_crawled_at: now.toISOString(),
          });
          productRecord = match.product;
          action = "MATCH_REVIEW";
        } else {
          const publishable =
            validation.status === "APPROVED" &&
            (premium.status === "PREMIUM" || premium.status === "APPROVED") &&
            sourceHealthy;
          const created = await admin.entities.Product.create({
            ...record,
            status: publishable ? "PUBLISHED" : "REVIEW",
          });
          products.push(created);
          productRecord = created;
          action = publishable ? "PUBLISHED" : "REVIEW";
        }

        // --- offer upsert (PRODUCT vs OFFER separation) ---
        if (productRecord && raw.price) {
          const offerData = {
            source_price: raw.price,
            currency: raw.currency,
            shipping_cost: 0,
            stock_status: raw.stock_status,
            countries: source.available_countries || [],
            supplier_score: source.supplier_score || 80,
            last_checked: now.toISOString(),
            stale: false,
            source_url: raw.url,
            source_product_id: String(raw.source_product_id || ""),
          };
          const existingOffer = offers.find(
            (o) => o.product_id === productRecord.id && o.source_id === source.id
          );
          if (existingOffer) {
            await admin.entities.Offer.update(existingOffer.id, offerData);
          } else {
            const createdOffer = await admin.entities.Offer.create({
              product_id: productRecord.id,
              source_id: source.id,
              ...offerData,
            });
            offers.push(createdOffer);
          }
        }

        await admin.entities.CrawlerJob.update(job.id, {
          status: "COMPLETED",
          completed_at: now.toISOString(),
          locked_at: null,
          result: JSON.stringify({ action, premium: premium.status, quality: validation.qualityScore }),
        });
        completed++;
        note(source.id, true);
      } catch (error) {
        const attempts = (job.attempts || 0) + 1;
        const msg = String((error && error.message) || error).slice(0, 500);
        if (attempts < (job.max_attempts || 3)) {
          await admin.entities.CrawlerJob.update(job.id, {
            status: "RETRYING",
            attempts,
            last_error: msg,
            scheduled_at: new Date(now.getTime() + (BACKOFFS[Math.min(attempts - 1, 2)] || 900) * 1000).toISOString(),
            locked_at: null,
          });
          retried++;
        } else {
          await admin.entities.CrawlerJob.update(job.id, {
            status: "FAILED",
            attempts,
            last_error: msg,
            locked_at: null,
          });
          failed++;
        }
        if (job.source_id) note(job.source_id, false);
      }
    }

    // --- source health: >30% fail = WARNING, >60% = ERROR (auto-publish paused) ---
    const sourceUpdates = [];
    for (const [sourceId, s] of Object.entries(perSource)) {
      const source = sources.find((x) => x.id === sourceId);
      if (!source) continue;
      const failRate = s.failed / Math.max(1, s.processed);
      let status = source.status;
      if (s.processed >= 3) {
        if (failRate > 0.6) status = "ERROR";
        else if (failRate > 0.3) status = "WARNING";
        else if (source.status !== "PAUSED" && source.status !== "DISABLED") status = "ACTIVE";
      }
      sourceUpdates.push({
        id: sourceId,
        status,
        products_updated: (source.products_updated || 0) + s.ok,
        products_failed: (source.products_failed || 0) + s.failed,
        last_error: s.failed ? source.last_error || "Some jobs failed" : source.last_error,
        last_success: s.ok ? now.toISOString() : source.last_success,
      });
    }
    if (sourceUpdates.length) await admin.entities.CrawlerSource.bulkUpdate(sourceUpdates);

    // --- freshness: enqueue refresh for stale offers (bounded) ---
    const staleOffers = offers
      .filter((o) => !o.stale && o.last_checked && now - new Date(o.last_checked) > STALE_OFFER_MS)
      .slice(0, 5);
    if (staleOffers.length) {
      await admin.entities.CrawlerJob.bulkCreate(
        staleOffers.map((o) => ({
          type: "UPDATE_PRICE",
          source_id: o.source_id,
          product_id: o.product_id,
          url: o.source_url,
          priority: 8,
          status: "QUEUED",
          scheduled_at: now.toISOString(),
        }))
      );
      await admin.entities.Offer.bulkUpdate(staleOffers.map((o) => ({ id: o.id, stale: true })));
    }

    waitUntil(
      admin.entities.AuditLog.create({
        actor_email: user.email,
        actor_id: user.id,
        action: "CRAWLER_PROCESS",
        target_type: "crawler_queue",
        details: `processed=${completed + failed + retried} completed=${completed} failed=${failed} retried=${retried}`,
      }).catch(() => {})
    );

    return Response.json({ ok: true, processed: jobs.length, completed, failed, retried, sources: sourceUpdates });
  } catch (error) {
    return Response.json({ error: error.message || "Queue processing failed" }, { status: 500 });
  }
}