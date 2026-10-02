// Client-side SEO helper — unique title, meta description, canonical URL,
// Open Graph / Twitter cards, hreflang alternates and structured data (JSON-LD).
//
// International by design: every language VEYRO serves gets its own crawlable
// URL (?lang=xx) with a self-referencing canonical and an hreflang alternate,
// so the catalog can rank in each market instead of being treated as duplicate.
//
// Structured data only ever carries information that is real and present on the
// page — no invented ratings, prices, availability or reviews.

export const SEO_LANGUAGES = ["en", "fr", "pt", "es", "ar"];
const DEFAULT_LANGUAGE = "en";

// Read from the URL immediately: the page's own SEO effect runs before the
// language provider's effect, so the initial value must already be correct.
let currentLang = (() => {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    return SEO_LANGUAGES.includes(fromUrl) ? fromUrl : DEFAULT_LANGUAGE;
  } catch (_e) {
    return DEFAULT_LANGUAGE;
  }
})();

export function setSeoLanguage(code) {
  if (SEO_LANGUAGES.includes(code)) currentLang = code;
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href, hreflang) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Same page, another language — a real, crawlable URL.
export function withLang(url, code) {
  const [base, hash = ""] = String(url).split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}lang=${code}${hash ? `#${hash}` : ""}`;
}

function breadcrumbLd(items, origin) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${origin}${it.path}`,
    })),
  };
}

// Roughly what a search engine displays before truncating.
const TITLE_MAX = 68;

// Search-optimised title: the searched keyword always comes first, the brand
// always last, and the whole string stays inside the visible length. The extra
// segments are tried longest-first, so the title degrades gracefully (a long
// product name keeps "Price" rather than losing the buying intent entirely).
export function seoTitle(keyword, extras, brand = "VEYRO") {
  const head = String(keyword || "").trim();
  const tail = ` | ${brand}`;
  const list = (Array.isArray(extras) ? extras : [extras]).filter(Boolean);
  for (const extra of list) {
    if (head.length + extra.length + tail.length + 3 <= TITLE_MAX) return `${head} — ${extra}${tail}`;
  }
  return `${head}${tail}`;
}

export function applySeo({ title, description, path, image, type = "website", jsonLd, breadcrumbs }) {
  const origin = window.location.origin;
  const rel = path || `${window.location.pathname}${window.location.search}`;
  // Never keep a language parameter in the canonical path — it is rebuilt below.
  const [relBase, relHash = ""] = rel.split("#");
  const [relPath, relQuery] = relBase.split("?");
  const cleanPath = (() => {
    if (!relQuery) return rel;
    const sp = new URLSearchParams(relQuery);
    sp.delete("lang");
    const qs = sp.toString();
    return `${relPath}${qs ? `?${qs}` : ""}${relHash ? `#${relHash}` : ""}`;
  })();
  const cleanUrl = `${origin}${cleanPath}`;
  const selfUrl = currentLang === DEFAULT_LANGUAGE ? cleanUrl : withLang(cleanUrl, currentLang);

  if (title) document.title = title;

  if (description) {
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:description", description);
  }
  if (title) {
    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);
  }
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:site_name", "VEYRO");
  upsertMeta("property", "og:locale", currentLang);
  upsertMeta("property", "og:url", selfUrl);
  upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
  if (image) {
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:image", image);
  }

  // Canonical points at this exact language version; English is the x-default.
  upsertLink("canonical", selfUrl);
  SEO_LANGUAGES.forEach((code) =>
    upsertLink("alternate", code === DEFAULT_LANGUAGE ? cleanUrl : withLang(cleanUrl, code), code)
  );
  upsertLink("alternate", cleanUrl, "x-default");

  // Page-level structured data — the site-wide Organization/WebSite graph
  // injected by index.html is left untouched.
  document.querySelectorAll("script[data-seo-page]").forEach((s) => s.remove());
  const blocks = [jsonLd, breadcrumbs && breadcrumbs.length ? breadcrumbLd(breadcrumbs, origin) : null]
    .flat()
    .filter(Boolean);
  blocks.forEach((block) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-page", "true");
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  });
}

// Real ItemList of the products actually rendered on a listing page.
export function itemListLd(name, products) {
  const items = (products || []).filter((p) => p && p.slug).slice(0, 20);
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${window.location.origin}/product/${p.slug}`,
      name: `${p.brand ? `${p.brand} ` : ""}${p.name}`,
    })),
  };
}