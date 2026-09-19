// Crawler WORKER core — shared by the admin "Process queue" endpoint and the
// automatic orchestrator. Claims queued jobs, fetches/parses (JSON-LD, og:meta,
// HTML images, embedded JSON state), verifies images, validates, matches,
// prices (via the central pricing rules), publishes. Job locking + crash
// recovery + exponential backoff + source health metrics.
// admin = service-role client. actor = { id, email } | null.
import {
  canonicalizeUrl, slugify, normalizeTitle, normalizePrice, normalizeCurrency,
  normalizeStock, normalizeBrand, inferCategory, extractVariantInfo,
} from "./normalize.js";
import { validateProduct } from "./validate.js";
import { matchProduct } from "./match.js";
import { premiumScore } from "./premium.js";
import { mergeConfig, resolveRules, computePriceChain } from "../commerce/rules.js";
import { parseProductPage, enrichFeedRaw, verifyImageAccessible, absolutizeImageUrl } from "./extract.js";

const BACKOFFS = [60, 300, 900]; // seconds: 1min, 5min, 15min
const STALE_LOCK_MS = 10 * 60 * 1000;
const STALE_OFFER_MS = 24 * 60 * 60 * 1000;
const IMG_MAIN_ATTEMPTS = 3;
const IMG_GALLERY_VERIFY = 2;
const GALLERY_MAX = 6;

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
    return true;
  }
}

function diffUpdate(existing, record) {
  const update = {};
  let changed = false;
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null || v === "") continue;
    const old = existing[k];
    if (JSON.stringify(old) !== JSON.stringify(v)) {
      update[k] = v;
      changed = true;
    }
  }
  return { update, changed };
}

export async function processQueueBatch({ admin, actor, maxJobs = 25 }) {
  const now = new Date();

  // --- queue: reclaim stale locks, claim due jobs by priority ---
  const [runningJobs, queuedAll, retryingAll] = await Promise.all([
    admin.entities.CrawlerJob.filter({ status: "RUNNING" }, null, 200),
    admin.entities.CrawlerJob.filter({ status: "QUEUED" }, "priority", 500),
    admin.entities.CrawlerJob.filter({ status: "RETRYING" }, "scheduled_at", 200),
  ]);
  const stale = runningJobs.filter((j) => j.locked_at && now - new Date(j.locked_at) > STALE_LOCK_MS);
  if (stale.length) {
    await admin.entities.CrawlerJob.bulkUpdate(
      stale.map((j) => ({ id: j.id, status: "QUEUED", locked_at: null, locked_by: null }))
    );
  }
  const queued = [...queuedAll, ...retryingAll]
    .filter((j) => !j.scheduled_at || new Date(j.scheduled_at) <= now)
    .sort((a, b) => (a.priority || 5) - (b.priority || 5));
  const jobs = queued.slice(0, maxJobs);
  if (!jobs.length) {
    return { processed: 0, completed: 0, failed: 0, retried: 0, note: "Queue empty" };
  }

  const sources = await admin.entities.CrawlerSource.list(null, 200);
  let products = await admin.entities.Product.list("-premium_score", 2000);
  let offers = await admin.entities.Offer.list(null, 1000);

  // --- central pricing rules (Super Admin Pricing & Business Rules module) ---
  const cfgDocs = await admin.entities.PricingConfig.filter({ active: true }, "-created_date", 5);
  const pricingConfig = mergeConfig(cfgDocs[0] || {});

  const perSource = {};
  const bump = (sourceId, key, by = 1) => {
    const s = (perSource[sourceId] = perSource[sourceId] || {
      processed: 0, ok: 0, failed: 0, found: 0, validated: 0, rejected: 0, imgFound: 0, imgFail: 0,
    });
    s[key] = (s[key] || 0) + by;
  };

  let completed = 0;
  let failed = 0;
  let retried = 0;
  const jobUpdates = [];

  for (const job of jobs) {
    await admin.entities.CrawlerJob.update(job.id, {
      status: "RUNNING",
      locked_at: now.toISOString(),
      locked_by: actor ? actor.id : "automation",
      started_at: now.toISOString(),
    });
    const source = sources.find((s) => s.id === job.source_id);
    try {
      if (!source) throw new Error("Source not found");
      bump(source.id, "processed");

      let raw = null;
      let pageImageCandidates = [];
      if (job.payload && (job.payload.title || job.payload.name)) {
        raw = enrichFeedRaw(job.payload);
      } else {
        if (!(await robotsAllows(job.url))) throw new Error("Blocked by robots.txt");
        const res = await fetchWithTimeout(job.url, 15000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseProductPage(await res.text(), job.url);
        raw = enrichFeedRaw(parsed.raw);
        pageImageCandidates = parsed.imageCandidates;
      }

      raw.title = normalizeTitle(raw.title);
      if (!raw.title) throw new Error("Rejected: no product title found on page");
      raw.price = normalizePrice(raw.price);
      raw.currency = normalizeCurrency(raw.currency) || normalizeCurrency(source.default_currency) || "USD";
      raw.brand = normalizeBrand(raw.brand, raw.title);
      raw.category = raw.category || inferCategory(`${raw.title} ${raw.brand || ""}`);
      raw.stock_status = normalizeStock(raw.stock);
      raw.url = raw.url || job.url;
      raw.canonical_url = canonicalizeUrl(raw.url, source.base_url) || raw.url;
      raw.slug = slugify(raw.brand ? `${raw.brand} ${raw.title}` : raw.title);
      bump(source.id, "found");

      const validation = validateProduct(raw);
      if (validation.missing.length) {
        bump(source.id, "rejected");
        throw new Error(`Rejected: ${validation.reason}`);
      }

      // --- images: absolutize, verify accessibility before publishing ---
      const mainCandidates = [];
      const pushMain = (u) => {
        const abs = absolutizeImageUrl(u, source.base_url);
        if (abs && !mainCandidates.includes(abs)) mainCandidates.push(abs);
      };
      pushMain(raw.image);
      pageImageCandidates.slice(0, IMG_MAIN_ATTEMPTS).forEach((c) => {
        if (!mainCandidates.includes(c)) mainCandidates.push(c);
      });
      let imageUrl = null;
      const mainChecks = await Promise.all(
        mainCandidates.slice(0, IMG_MAIN_ATTEMPTS).map((c) => verifyImageAccessible(c).then((ok) => ({ c, ok })))
      );
      for (const { c, ok } of mainChecks) {
        if (ok) {
          if (!imageUrl) imageUrl = c;
          bump(source.id, "imgFound");
        } else {
          bump(source.id, "imgFail");
        }
      }
      if (!imageUrl && mainCandidates.length) imageUrl = mainCandidates[0];

      const gallery = [];
      if (Array.isArray(raw.gallery)) {
        const uniq = [...new Set(raw.gallery.map((g) => absolutizeImageUrl(g, source.base_url)).filter(Boolean))]
          .filter((u) => u !== imageUrl);
        const galleryChecks = await Promise.all(
          uniq.slice(0, IMG_GALLERY_VERIFY).map((g) => verifyImageAccessible(g).then((ok) => ({ g, ok })))
        );
        for (const { g, ok } of galleryChecks) {
          if (ok) {
            gallery.push(g);
            bump(source.id, "imgFound");
          } else {
            bump(source.id, "imgFail");
          }
        }
      }

      // --- pricing via central rules / premium / dedupe ---
      const rules = resolveRules(pricingConfig, { category: raw.category, source_id: source.id });
      const chain = computePriceChain(raw.price, rules, { installments: false });
      const customerPrice = chain.customer_price;
      const compareAt = normalizePrice(raw.compare_at_price);
      const premium = premiumScore({ brand: raw.brand, priceUsd: raw.price, qualityScore: validation.qualityScore });
      const match = matchProduct(raw, products);

      const record = {
        name: raw.title,
        slug: raw.slug,
        brand: raw.brand || undefined,
        category: raw.category || "Accessories",
        source_price: compareAt && compareAt > raw.price ? compareAt : raw.price,
        customer_price: customerPrice,
        currency: raw.currency,
        image_url: imageUrl,
        gallery: gallery.length ? gallery.slice(0, GALLERY_MAX) : undefined,
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
        specifications: raw.variant_sample && raw.variant_sample.length
          ? { options: raw.option_names || [], variants: raw.variant_sample }
          : undefined,
        available_date: raw.available_date || raw.release_date || raw.availability_date || undefined,
        variant_info: extractVariantInfo(raw) || undefined,
      };

      let productRecord = null;
      let action = null;
      if (match.decision === "AUTO_MATCH" && match.product) {
        const { update, changed } = diffUpdate(match.product, record);
        // Track real price / stock movements (feeds the New Arrivals analytics)
        if (
          record.customer_price != null && match.product.customer_price != null &&
          record.customer_price !== match.product.customer_price
        ) {
          update.price_changed_at = now.toISOString();
          update.previous_price = match.product.customer_price;
        }
        if (record.stock_status && record.stock_status !== match.product.stock_status) {
          update.stock_changed_at = now.toISOString();
        }
        if (Object.keys(update).length) {
          await admin.entities.Product.update(match.product.id, update);
          action = "UPDATED";
        } else {
          action = "UNCHANGED";
        }
        productRecord = match.product;
      } else if (match.decision === "MANUAL_REVIEW" && match.product) {
        await admin.entities.Product.update(match.product.id, {
          match_confidence: match.confidence,
          review_reason: `Uncertain match (${Math.round(match.confidence * 100)}%) with a newly crawled "${raw.title}" — needs human eyes`,
          last_crawled_at: now.toISOString(),
        });
        productRecord = match.product;
        action = "MATCH_REVIEW";
      } else {
        const created = await admin.entities.Product.create({
          ...record,
          brand: record.brand || "Unknown",
          status: "PUBLISHED",
          first_seen_at: now.toISOString(),
        });
        products.push(created);
        productRecord = created;
        action = "PUBLISHED";
      }
      bump(source.id, "validated");

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

      jobUpdates.push({
        id: job.id,
        status: "COMPLETED",
        completed_at: now.toISOString(),
        locked_at: null,
        result: JSON.stringify({
          action,
          premium: premium.status,
          quality: validation.qualityScore,
          image: imageUrl ? "ok" : "none",
        }),
      });
      completed++;
      bump(source.id, "ok");
    } catch (error) {
      const msg = String((error && error.message) || error).slice(0, 500);
      const deterministic = msg.startsWith("Rejected:");
      const attempts = (job.attempts || 0) + 1;
      if (!deterministic && attempts < (job.max_attempts || 3)) {
        jobUpdates.push({
          id: job.id,
          status: "RETRYING",
          attempts,
          last_error: msg,
          scheduled_at: new Date(now.getTime() + (BACKOFFS[Math.min(attempts - 1, 2)] || 900) * 1000).toISOString(),
          locked_at: null,
        });
        retried++;
      } else {
        jobUpdates.push({
          id: job.id,
          status: "FAILED",
          attempts,
          last_error: msg,
          locked_at: null,
        });
        failed++;
      }
      if (job.source_id) bump(job.source_id, "failed");
    }
  }

  if (jobUpdates.length) {
    await admin.entities.CrawlerJob.bulkUpdate(jobUpdates);
  }

  // --- flush per-source metrics + health (>30% fail = WARNING, >60% = ERROR) ---
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
      products_found: (source.products_found || 0) + s.found,
      products_validated: (source.products_validated || 0) + s.validated,
      products_rejected: (source.products_rejected || 0) + s.rejected,
      images_found: (source.images_found || 0) + s.imgFound,
      images_failed: (source.images_failed || 0) + s.imgFail,
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

  if (actor) {
    await admin.entities.AuditLog.create({
      actor_email: actor.email,
      actor_id: actor.id,
      action: "CRAWLER_PROCESS",
      target_type: "crawler_queue",
      details: `processed=${completed + failed + retried} completed=${completed} failed=${failed} retried=${retried}`,
    }).catch(() => {});
  }

  return { processed: jobs.length, completed, failed, retried, sources: sourceUpdates };
}