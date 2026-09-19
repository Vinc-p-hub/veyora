// Data extraction from merchant pages & feeds: JSON-LD, meta tags (og:), HTML images
// (src, data-src, srcset, <picture>), embedded JSON state for JS-heavy sites, and
// Shopify-style feed enrichment (variants, galleries, compare-at prices).
// Pure functions (except verifyImageAccessible) — shared by the worker and tests.
import { normalizePrice, normalizeCurrency, normalizeTitle } from "./normalize.js";

const JUNK_IMAGE_RE = /(logo|icon|sprite|avatar|placeholder|favicon|payment|visa|mastercard|amex|apple-pay|flag|pixel)/i;
const MAX_DESCRIPTION = 2000;

export function stripHtml(str) {
  return (str || "")
    .toString()
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function decodeHtmlEntities(str) {
  return (str || "")
    .toString()
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ");
}

// Relative -> absolute image URL; drops data: URIs and non-HTTP(s) schemes.
export function absolutizeImageUrl(raw, baseUrl) {
  if (!raw) return null;
  const s = typeof raw === "string" ? raw.trim() : raw.src || raw.url;
  if (!s || s.startsWith("data:")) return null;
  try {
    const u = new URL(s, baseUrl || undefined);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch (_e) {
    return null;
  }
}

function collectProductNodes(nodes, out) {
  for (const x of nodes || []) {
    if (!x || typeof x !== "object") continue;
    if (Array.isArray(x)) {
      collectProductNodes(x, out);
      continue;
    }
    const types = Array.isArray(x["@type"]) ? x["@type"] : [x["@type"]];
    if (types.includes("Product")) out.push(x);
    for (const key of ["@graph", "hasPart", "mainEntity"]) {
      if (Array.isArray(x[key])) collectProductNodes(x[key], out);
      else if (x[key] && typeof x[key] === "object") collectProductNodes([x[key]], out);
    }
  }
}

export function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      collectProductNodes(Array.isArray(parsed) ? parsed : [parsed], out);
    } catch (_e) {
      /* malformed JSON-LD block — skip */
    }
  }
  return out;
}

function imageUrlsFrom(image) {
  const urls = [];
  const push = (v) => {
    if (typeof v === "string") urls.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === "object" && typeof v.url === "string") urls.push(v.url);
  };
  push(image);
  return urls.filter(Boolean);
}

export function jsonLdToRaw(doc, url) {
  const offers = Array.isArray(doc.offers) ? doc.offers[0] : doc.offers;
  const offerPrice = offers && (offers.price !== undefined ? offers.price : offers.lowPrice !== undefined ? offers.lowPrice : offers.highPrice);
  const brand = typeof doc.brand === "object" ? (doc.brand && doc.brand.name) : doc.brand;
  const images = imageUrlsFrom(doc.image);
  return {
    title: doc.name,
    brand,
    price: normalizePrice(offerPrice),
    currency: normalizeCurrency(offers && offers.priceCurrency),
    url: (offers && offers.url) || url,
    image: images[0] || null,
    gallery: images,
    sku: doc.sku,
    gtin: doc.gtin13 || doc.gtin12 || doc.gtin,
    mpn: doc.mpn,
    model: doc.model,
    category: typeof doc.category === "object" ? undefined : doc.category,
    description: doc.description,
    stock: offers && offers.availability,
  };
}

function metaContent(html, names) {
  for (const n of names) {
    for (const re of [
      new RegExp(`<meta[^>]+(?:property|itemprop|name)=["']${n}["'][^>]*content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|itemprop|name)=["']${n}["']`, "i"),
    ]) {
      const m = html.match(re);
      if (m && m[1]) return decodeHtmlEntities(m[1]);
    }
  }
  return null;
}

export function extractMeta(html) {
  return {
    title: metaContent(html, ["og:title", "twitter:title"]),
    description: metaContent(html, ["og:description", "description"]),
    image: metaContent(html, ["og:image", "og:image:secure_url", "twitter:image", "image"]),
    price: metaContent(html, ["product:price:amount", "og:price:amount", "price"]),
    currency: metaContent(html, ["product:price:currency", "og:price:currency", "priceCurrency", "currency"]),
    availability: metaContent(html, ["product:availability", "og:availability", "availability"]),
  };
}

// Gathers product image candidates from img/srcset/data-src/<source>/og:image.
export function extractImageCandidates(html, baseUrl, limit = 10) {
  const found = [];
  const seen = new Set();
  const add = (rawUrl) => {
    const abs = absolutizeImageUrl(rawUrl, baseUrl);
    if (!abs || seen.has(abs) || JUNK_IMAGE_RE.test(abs)) return;
    seen.add(abs);
    found.push(abs);
  };

  // srcset / data-srcset: keep the largest candidate of each set
  const srcsetRe = /(?:data-srcset|srcset)=["']([^"']+)["']/gi;
  let m;
  while ((m = srcsetRe.exec(html)) && found.length < limit * 2) {
    const parts = m[1].split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
    if (parts.length) add(parts[parts.length - 1]);
  }

  // <img> and <picture><source> tags
  const tagRe = /<(?:img|source)\b[^>]*>/gi;
  while ((m = tagRe.exec(html)) && found.length < limit * 2) {
    const tag = m[0];
    for (const attr of ["data-src", "data-original", "data-lazy-src", "src"]) {
      const am = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
      if (am) {
        add(am[1]);
        break;
      }
    }
  }
  return found.slice(0, limit);
}

// JS-heavy storefronts often embed product state in script JSON (__NEXT_DATA__, etc.)
export function extractEmbeddedJson(html) {
  const blocks = [];
  const re = /<script[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (_e) {
      /* not JSON — skip */
    }
  }
  const raws = [];
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6 || raws.length >= 3) return;
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, depth + 1));
      return;
    }
    const title = node.name || node.title;
    const price = node.price || (node.priceRange && node.priceRange.min && node.priceRange.min.amount);
    if (title && (price || node.offers || node.variants)) {
      raws.push({
        title: normalizeTitle(title),
        price: normalizePrice(price),
        currency: normalizeCurrency(node.priceCurrency || node.currency),
        image: typeof node.image === "string" ? node.image : node.image && (node.image.src || node.image.url),
      });
    }
    for (const k of Object.keys(node)) {
      if (node[k] && typeof node[k] === "object") visit(node[k], depth + 1);
    }
  };
  blocks.forEach((b) => visit(b, 0));
  return raws;
}

// Full page parse: JSON-LD first, then og:/meta tags, then embedded JSON state.
export function parseProductPage(html, url) {
  let baseUrl = null;
  try {
    baseUrl = new URL(url).origin;
  } catch (_e) {
    /* keep null */
  }
  const docs = extractJsonLd(html);
  let raw = docs.length ? jsonLdToRaw(docs[0], url) : {};
  const meta = extractMeta(html);
  if (!raw.title) raw.title = normalizeTitle(meta.title);
  if (!raw.description && meta.description) raw.description = meta.description;
  if (raw.price === null || raw.price === undefined) raw.price = normalizePrice(meta.price);
  if (!raw.currency && meta.currency) raw.currency = normalizeCurrency(meta.currency);
  if (!raw.stock) raw.stock = meta.availability;
  if (!raw.image && meta.image) raw.image = absolutizeImageUrl(meta.image, baseUrl);
  if (raw.image) raw.image = absolutizeImageUrl(raw.image, baseUrl);
  if (!raw.url) raw.url = url;

  const ogImage = meta.image ? absolutizeImageUrl(meta.image, baseUrl) : null;
  const imageCandidates = [...new Set([...(ogImage ? [ogImage] : []), ...extractImageCandidates(html, baseUrl, 10)])];

  if (!raw.title || raw.price === null || raw.price === undefined) {
    for (const emb of extractEmbeddedJson(html)) {
      if (!raw.title && emb.title) raw.title = emb.title;
      if ((raw.price === null || raw.price === undefined) && emb.price) raw.price = emb.price;
      if (!raw.currency && emb.currency) raw.currency = emb.currency;
      if (!raw.image && emb.image) raw.image = absolutizeImageUrl(emb.image, baseUrl);
      if (raw.title && raw.price != null) break;
    }
  }
  return { raw, imageCandidates };
}

// Enriches mapped feed items (Shopify-style shape) into a normalized raw product:
// best available variant wins, gallery extracted, HTML descriptions stripped,
// compare-at prices kept for discount display, variants preserved for specs.
export function enrichFeedRaw(raw) {
  const out = { ...raw };
  if (Array.isArray(out.variants) && out.variants.length) {
    const available = out.variants.filter((v) => v.available !== false);
    const pool = available.length ? available : out.variants;
    const best = [...pool].sort((a, b) => (parseFloat(a.price) || Infinity) - (parseFloat(b.price) || Infinity))[0];
    out.price = best && best.price !== undefined ? best.price : out.price;
    if (!out.stock) out.stock = available.length ? "true" : "false";
    if (!out.sku && best && best.sku) out.sku = best.sku;
    const compareAts = out.variants.map((v) => parseFloat(v.compare_at_price)).filter((n) => isFinite(n) && n > 0);
    if (compareAts.length) out.compare_at_price = Math.max(...compareAts);
    out.variant_sample = out.variants.slice(0, 20).map((v) => ({
      title: v.title || null,
      price: v.price !== undefined ? String(v.price) : null,
      available: v.available !== false,
      sku: v.sku || null,
    }));
    out.option_names = Array.isArray(out.options) ? out.options.map((o) => o && o.name).filter(Boolean) : [];
  }
  if (Array.isArray(out.images)) {
    const urls = out.images.map((i) => (typeof i === "string" ? i : i && (i.src || i.url))).filter(Boolean);
    if (!out.image) out.image = urls[0] || null;
    if (urls.length) out.gallery = urls;
    delete out.images;
  }
  if (out.image && typeof out.image === "object") out.image = out.image.src || out.image.url || null;
  if (typeof out.description === "string" && /<\/?[a-z][\s\S]*>/i.test(out.description)) {
    out.description = stripHtml(out.description);
  }
  if (out.description && out.description.length > MAX_DESCRIPTION) {
    out.description = out.description.slice(0, MAX_DESCRIPTION).trim() + "…";
  }
  return out;
}

// Verifies an image is really accessible before it gets published.
export async function verifyImageAccessible(url, timeoutMs = 6000) {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "VeyroBot/1.0 (+catalog ingestion)" },
    });
    if (res.ok) return true;
    if (res.status === 403 || res.status === 405) {
      const get = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": "Mozilla/5.0 (compatible; VeyroBot/1.0)", range: "bytes=0-0" },
      });
      return get.ok || get.status === 206;
    }
    return false;
  } catch (_e) {
    return false;
  }
}