// Crawler discovery: loads a source adapter, discovers products, enqueues FETCH_PRODUCT jobs.
// Admin-only. The queue itself is processed by crawlerProcessQueue.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { canonicalizeUrl } from "../../shared/catalog/normalize.js";

const MAX_PER_RUN_CAP = 100;

function resolvePath(obj, path) {
  if (!path) return obj;
  return String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// field_map value forms: "dot.path", "const:X", "tpl:{base_url}/products/{id}"
function mapItem(item, fieldMap, source) {
  const raw = {};
  for (const [field, spec] of Object.entries(fieldMap || {})) {
    const s = String(spec == null ? "" : spec);
    if (s.startsWith("const:")) {
      raw[field] = s.slice(6);
    } else if (s.startsWith("tpl:")) {
      raw[field] = s
        .slice(4)
        .replace(/\{base_url\}/g, (source.base_url || "").replace(/\/+$/, ""))
        .replace(/\{(\w+(?:\.\w+)*)\}/g, (_m, p) => String(resolvePath(item, p) ?? ""));
    } else {
      raw[field] = resolvePath(item, s);
    }
  }
  return raw;
}

async function fetchWithTimeout(url, ms) {
  return await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { "user-agent": "VeyroBot/1.0 (+catalog ingestion)" },
  });
}

function extractSitemapUrls(xml) {
  const urls = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) urls.push(m[1]);
  return urls;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const admin = base44.asServiceRole;
    const sources = await admin.entities.CrawlerSource.list(null, 200);
    const source = sources.find((s) => s.id === body.source_id);
    if (!source) return Response.json({ error: "Source not found" }, { status: 404 });
    if (!source.enabled || source.status === "DISABLED") {
      return Response.json({ error: "Source is disabled" }, { status: 400 });
    }

    const now = new Date();
    const max = Math.min(Number(source.max_products_per_run) || 30, MAX_PER_RUN_CAP);
    const jobs = [];

    if (source.adapter === "FEED_JSON") {
      const res = await fetchWithTimeout(source.feed_url, 20000);
      if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
      const doc = await res.json();
      const items = resolvePath(doc, source.items_path);
      if (!Array.isArray(items)) throw new Error("Feed items not found at items_path");
      for (const item of items.slice(0, max)) {
        const raw = mapItem(item, source.field_map, source);
        const url = raw.url || null;
        jobs.push({
          type: "FETCH_PRODUCT",
          source_id: source.id,
          url,
          priority: source.priority || 5,
          status: "QUEUED",
          scheduled_at: now.toISOString(),
          payload: raw,
        });
      }
    } else if (source.adapter === "SITEMAP_JSONLD") {
      const res = await fetchWithTimeout(source.feed_url, 20000);
      if (!res.ok) throw new Error(`Sitemap HTTP ${res.status}`);
      let urls = extractSitemapUrls(await res.text());
      // follow sitemap indexes one level deep
      if (urls.some((u) => u.endsWith(".xml")) && source.max_depth > 1) {
        const childUrls = urls.filter((u) => u.endsWith(".xml")).slice(0, 5);
        urls = urls.filter((u) => !u.endsWith(".xml"));
        for (const child of childUrls) {
          try {
            const r = await fetchWithTimeout(child, 15000);
            if (r.ok) urls.push(...extractSitemapUrls(await r.text()).filter((u) => !u.endsWith(".xml")));
          } catch (_e) { /* child sitemap unreachable — continue */ }
        }
      }
      const pattern = source.url_pattern ? new RegExp(source.url_pattern) : null;
      for (const u of urls) {
        if (jobs.length >= max) break;
        if (pattern && !pattern.test(u)) continue;
        const canonical = canonicalizeUrl(u, source.base_url);
        if (!canonical) continue;
        jobs.push({
          type: "FETCH_PRODUCT",
          source_id: source.id,
          url: canonical,
          priority: source.priority || 5,
          status: "QUEUED",
          scheduled_at: now.toISOString(),
        });
      }
    } else if (source.adapter === "URL_LIST_JSONLD") {
      for (const u of source.seed_urls || []) {
        if (jobs.length >= max) break;
        const canonical = canonicalizeUrl(u, source.base_url);
        if (!canonical) continue;
        jobs.push({
          type: "FETCH_PRODUCT",
          source_id: source.id,
          url: canonical,
          priority: source.priority || 5,
          status: "QUEUED",
          scheduled_at: now.toISOString(),
        });
      }
    } else {
      return Response.json({ error: "Unknown adapter" }, { status: 400 });
    }

    // create jobs in chunks
    for (let i = 0; i < jobs.length; i += 50) {
      await admin.entities.CrawlerJob.bulkCreate(jobs.slice(i, i + 50));
    }

    await admin.entities.CrawlerSource.update(source.id, {
      last_run: now.toISOString(),
      next_run: new Date(now.getTime() + (source.crawl_interval_minutes || 720) * 60000).toISOString(),
      products_discovered: (source.products_discovered || 0) + jobs.length,
    });
    await admin.entities.AuditLog.create({
      actor_email: user.email,
      actor_id: user.id,
      action: "CRAWLER_RUN",
      target_type: "crawler_source",
      target_id: source.id,
      details: `${source.adapter} discovered ${jobs.length} products`,
    });

    return Response.json({ ok: true, source_id: source.id, discovered: jobs.length, jobs: jobs.length });
  } catch (error) {
    return Response.json({ error: error.message || "Crawler run failed" }, { status: 500 });
  }
}