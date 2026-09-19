// Crawler DISCOVERY core — shared by the admin "Run now" endpoint and the
// automatic orchestrator. Loads a source adapter, discovers product pages,
// enqueues FETCH_PRODUCT jobs, and updates source metrics.
import { canonicalizeUrl } from "./normalize.js";
import { discoveryPriority } from "./priority.js";

const MAX_PER_RUN_CAP = 250;
const MAX_FEED_PAGES = 20;

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
    headers: {
      "user-agent": "VeyroBot/1.0 (+catalog ingestion)",
      accept: "application/json, text/xml, text/html;q=0.8",
    },
  });
}

function extractSitemapUrls(xml) {
  const urls = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) urls.push(m[1]);
  return urls;
}

function pageUrl(feedUrl, page) {
  if (feedUrl.includes("{page}")) return feedUrl.replace("{page}", String(page));
  return feedUrl + (feedUrl.includes("?") ? "&" : "?") + "page=" + page;
}

// admin = service-role client. actor = { id, email } | null (for audit logging).
export async function runDiscovery({ admin, source, actor }) {
  const now = new Date();
  const max = Math.min(Number(source.max_products_per_run) || 30, MAX_PER_RUN_CAP);
  const jobs = [];
  let discoveredRaw = 0;

  if (source.adapter === "FEED_JSON") {
    const items = [];
    if (source.feed_pagination) {
      for (let page = 1; page <= MAX_FEED_PAGES; page++) {
        const res = await fetchWithTimeout(pageUrl(source.feed_url, page), 25000);
        if (!res.ok) {
          if (page === 1) throw new Error(`Feed HTTP ${res.status}`);
          break;
        }
        const doc = await res.json().catch(() => null);
        const pageItems = Array.isArray(doc) ? doc : resolvePath(doc, source.items_path);
        if (!Array.isArray(pageItems) || !pageItems.length) break;
        items.push(...pageItems);
        if (items.length >= max) break;
      }
    } else {
      const res = await fetchWithTimeout(source.feed_url, 25000);
      if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
      const doc = await res.json();
      const pageItems = resolvePath(doc, source.items_path);
      if (!Array.isArray(pageItems)) throw new Error("Feed items not found at items_path");
      items.push(...pageItems);
    }
    discoveredRaw = items.length;
    for (const item of items) {
      if (jobs.length >= max) break;
      const raw = mapItem(item, source.field_map, source);
      // Flagship smartphones / laptops from priority brands jump the queue.
      const prio = discoveryPriority(
        { title: raw.title || raw.name, brand: raw.brand, category: raw.category },
        source.priority || 5
      );
      jobs.push({
        type: "FETCH_PRODUCT",
        source_id: source.id,
        url: raw.url || null,
        priority: prio,
        status: "QUEUED",
        scheduled_at: now.toISOString(),
        payload: raw,
      });
    }
  } else if (source.adapter === "SITEMAP_JSONLD") {
    const res = await fetchWithTimeout(source.feed_url, 25000);
    if (!res.ok) throw new Error(`Sitemap HTTP ${res.status}`);
    let urls = extractSitemapUrls(await res.text());
    if (urls.some((u) => u.endsWith(".xml")) && source.max_depth > 1) {
      const childUrls = urls.filter((u) => u.endsWith(".xml")).slice(0, 10);
      urls = urls.filter((u) => !u.endsWith(".xml"));
      for (const child of childUrls) {
        try {
          const r = await fetchWithTimeout(child, 15000);
          if (r.ok) urls.push(...extractSitemapUrls(await r.text()).filter((u) => !u.endsWith(".xml")));
        } catch (_e) {
          /* child sitemap unreachable — continue */
        }
      }
    }
    const pattern = source.url_pattern ? new RegExp(source.url_pattern) : null;
    for (const u of urls) {
      if (pattern && !pattern.test(u)) continue;
      const canonical = canonicalizeUrl(u, source.base_url);
      if (!canonical) continue;
      discoveredRaw++;
      if (jobs.length >= max) break;
      jobs.push({
        type: "FETCH_PRODUCT",
        source_id: source.id,
        url: canonical,
        // Flagship smartphones / laptops (iphone, macbook, thinkpad…) jump the
        // queue even for sitemap / URL-list sources, based on the URL slug.
        priority: discoveryPriority({ title: u.replace(/[-_/?=&]+/g, " ") }, source.priority || 5),
        status: "QUEUED",
        scheduled_at: now.toISOString(),
      });
    }
  } else if (source.adapter === "URL_LIST_JSONLD") {
    for (const u of source.seed_urls || []) {
      const canonical = canonicalizeUrl(u, source.base_url);
      if (!canonical) continue;
      discoveredRaw++;
      if (jobs.length >= max) break;
      jobs.push({
        type: "FETCH_PRODUCT",
        source_id: source.id,
        url: canonical,
        // Flagship smartphones / laptops (iphone, macbook, thinkpad…) jump the
        // queue even for sitemap / URL-list sources, based on the URL slug.
        priority: discoveryPriority({ title: u.replace(/[-_/?=&]+/g, " ") }, source.priority || 5),
        status: "QUEUED",
        scheduled_at: now.toISOString(),
      });
    }
  } else {
    throw new Error("Unknown adapter");
  }

  // --- dedupe: within this run + against jobs already queued/retrying for this source ---
  const activeJobs = await admin.entities.CrawlerJob.list(null, 500);
  const activeKey = new Set(
    activeJobs
      .filter((j) => j.status === "QUEUED" || j.status === "RETRYING" || j.status === "RUNNING")
      .map((j) => `${j.source_id}|${j.url}`)
  );
  const seen = new Set();
  const uniqueJobs = jobs.filter((j) => {
    if (!j.url) return true;
    const key = `${j.source_id}|${j.url}`;
    if (seen.has(key) || activeKey.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (let i = 0; i < uniqueJobs.length; i += 50) {
    await admin.entities.CrawlerJob.bulkCreate(uniqueJobs.slice(i, i + 50));
  }

  await admin.entities.CrawlerSource.update(source.id, {
    last_run: now.toISOString(),
    next_run: new Date(now.getTime() + (source.crawl_interval_minutes || 720) * 60000).toISOString(),
    urls_discovered: (source.urls_discovered || 0) + discoveredRaw,
    products_discovered: (source.products_discovered || 0) + uniqueJobs.length,
  });
  if (actor) {
    await admin.entities.AuditLog.create({
      actor_email: actor.email,
      actor_id: actor.id,
      action: "CRAWLER_RUN",
      target_type: "crawler_source",
      target_id: source.id,
      details: `${source.adapter} saw ${discoveredRaw} products, enqueued ${uniqueJobs.length} (duplicates skipped: ${jobs.length - uniqueJobs.length})`,
    }).catch(() => {});
  }

  return {
    source_id: source.id,
    discovered: discoveredRaw,
    enqueued: uniqueJobs.length,
    duplicates_skipped: jobs.length - uniqueJobs.length,
  };
}