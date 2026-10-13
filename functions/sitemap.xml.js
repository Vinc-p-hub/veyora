// Dynamic XML sitemap built from the live catalog: static pages, categories, brands and every
// published product, with hreflang alternates, real image entries and lastmod from the data.
import { sb, esc, LANGS, withLang } from "./_lib/ssr.js";

const CATEGORIES = ["Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors", "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home", "Networking", "Computer Components"];
const STATIC = ["/", "/category", "/compare", "/financing-info", "/financing-calculator", "/support", "/contact", "/legal", "/terms", "/privacy", "/refund-policy", "/shipping-policy", "/return-policy", "/warranty", "/seller-policy", "/reviews-policy", "/cookie-policy"];
const day = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null; };

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const products = [];
  try {
    for (let offset = 0; offset < 45000; offset += 1000) {
      const page = await sb(context.env, `products?status=eq.PUBLISHED&slug=not.is.null&image_url=not.is.null&order=updated_date.desc&limit=1000&offset=${offset}&select=slug,name,brand,image_url,gallery,updated_date,last_crawled_at`);
      products.push(...page);
      if (page.length < 1000) break;
    }
  } catch { /* serve what we have */ }

  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].slice(0, 500);
  const entries = [];
  const add = (path, changefreq, priority, lastmod, images, title) => entries.push({ path, changefreq, priority, lastmod, images, title });
  STATIC.forEach((p) => add(p, "weekly", p === "/" ? "1.0" : "0.4"));
  CATEGORIES.forEach((c) => add(`/category?cat=${encodeURIComponent(c)}`, "daily", "0.7"));
  brands.forEach((b) => add(`/brand/${encodeURIComponent(b)}`, "daily", "0.6"));
  products.forEach((p) => {
    const images = [...new Set([p.image_url, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean))].slice(0, 6);
    add(`/product/${p.slug}`, "daily", "0.8", day(p.updated_date || p.last_crawled_at), images, p.name);
  });

  const block = (e) => {
    const loc = `${origin}${e.path}`;
    const l = [`    <loc>${esc(loc)}</loc>`];
    if (e.lastmod) l.push(`    <lastmod>${e.lastmod}</lastmod>`);
    l.push(`    <changefreq>${e.changefreq}</changefreq>`, `    <priority>${e.priority}</priority>`);
    LANGS.forEach((c) => l.push(`    <xhtml:link rel="alternate" hreflang="${c}" href="${esc(withLang(loc, c))}"/>`));
    l.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc)}"/>`);
    (e.images || []).forEach((img) => l.push(`    <image:image><image:loc>${esc(img)}</image:loc>${e.title ? `<image:title>${esc(e.title)}</image:title>` : ""}</image:image>`));
    return `  <url>\n${l.join("\n")}\n  </url>`;
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.map(block).join("\n")}\n</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
