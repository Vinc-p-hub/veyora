// Super Admin: auto-detect crawl configuration for candidate merchant sites —
// robots.txt compliance check + sitemap discovery. Never bypasses protections:
// a site that disallows automated crawling is reported as not allowed so the
// admin marks it unavailable instead of crawling it.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

const UA = "VeyroBot/1.0 (+catalog ingestion)";
const MAX_BASE_URLS = 10;
const SITEMAP_CANDIDATES = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
  "/sitemap/sitemap.xml",
  "/sitemaps.xml",
];

function timeoutFetch(url, ms) {
  return fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { "user-agent": UA },
  });
}

// Does the robots.txt "*" (or VeyroBot) group disallow everything?
function robotsDisallowsAll(text) {
  const lines = text.split("\n").map((l) => l.trim().toLowerCase());
  let active = false;
  let disallowAll = false;
  for (const l of lines) {
    if (l.startsWith("user-agent:")) {
      const ua = l.slice(10).trim();
      active = ua === "*" || ua.includes("veyro");
    } else if (active && l.startsWith("disallow:")) {
      const p = l.slice(9).trim();
      if (p === "/") disallowAll = true;
    }
  }
  return disallowAll;
}

async function detectOne(raw) {
  let url = String(raw || "").trim();
  if (!url) return { status: "invalid", note: "Empty URL" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch (_e) {
    return { base_url: url, status: "invalid", note: "Not a valid URL" };
  }

  let robots = null;
  const robotsUrl = origin + "/robots.txt";
  try {
    const r = await timeoutFetch(robotsUrl, 8000);
    if (r.ok) robots = await r.text();
  } catch (_e) {
    /* no robots.txt — assume crawling allowed, keep going */
  }

  if (robots && robotsDisallowsAll(robots)) {
    return {
      base_url: origin,
      status: "not_allowed",
      robots_url: robotsUrl,
      note: "robots.txt disallows automated crawling — marked unavailable, not crawled.",
    };
  }

  const sitemapUrls = [];
  if (robots) {
    for (const m of robots.matchAll(/^sitemap:\s*(\S+)/gim)) sitemapUrls.push(m[1]);
  }

  // Verify a sitemap candidate actually returns a sitemap document.
  let sitemap = null;
  const candidates = [...sitemapUrls.slice(0, 3), ...SITEMAP_CANDIDATES.map((p) => origin + p)];
  for (const c of candidates.slice(0, 8)) {
    try {
      const r = await timeoutFetch(c, 8000);
      if (r.ok) {
        const body = await r.text();
        if (body.includes("<urlset") || body.includes("<sitemapindex")) {
          sitemap = c;
          break;
        }
      }
    } catch (_e) {
      /* candidate unreachable — try the next */
    }
  }

  if (!sitemap) {
    return {
      base_url: origin,
      status: "no_sitemap",
      robots_url: robotsUrl,
      note: "No reachable sitemap found — add manually with a JSON feed or product URL list.",
    };
  }
  return {
    base_url: origin,
    status: "ok",
    adapter: "SITEMAP_JSONLD",
    feed_url: sitemap,
    robots_url: robotsUrl,
    note: "Ready to crawl (robots.txt respected).",
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body.base_urls) ? body.base_urls : [body.base_url];
    const urls = raw.map((u) => String(u || "").trim()).filter(Boolean).slice(0, MAX_BASE_URLS);
    if (!urls.length) return Response.json({ error: "Provide at least one base URL" }, { status: 400 });

    const results = [];
    for (const u of urls) {
      results.push(await detectOne(u));
    }
    return Response.json({
      ok: true,
      results,
      note: urls.length < raw.length ? `Limited to the first ${MAX_BASE_URLS} URLs per batch.` : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Detection failed" }, { status: 500 });
  }
}