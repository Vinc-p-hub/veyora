// Dynamic XML sitemap — the real published catalog: static pages, legal pages,
// category landing pages, brand landing pages and every published product.
//
// International by design: every URL declares its language alternates
// (?lang=en|fr|pt|es|ar) so search engines index the right market version, and
// product URLs expose their real images (image sitemap) with a lastmod taken
// from the catalog itself. Nothing is invented — no fake dates, no fake images.
//
// Public endpoint intended for search engines: /functions/sitemap
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

const LANGUAGES = ["en", "fr", "pt", "es", "ar"];
const CATEGORIES = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
];
const STATIC_PATHS = [
  "/", "/category", "/compare", "/financing-info", "/financing-calculator",
  "/support", "/contact", "/legal", "/terms", "/privacy", "/refund-policy",
  "/shipping-policy", "/return-policy", "/warranty", "/seller-policy",
  "/reviews-policy", "/cookie-policy",
];

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const withLang = (path, code) => {
  if (code === "en") return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}lang=${code}`;
};

const day = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Public origin of the storefront. The proxy forwards the original host;
    // when the function is reached on an internal worker host we fall back to
    // the published storefront so crawlers never receive internal URLs.
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const internal = !host || /workers\.dev$/i.test(host);
    const origin = internal ? "https://veyro-tech-prime.base44.app" : `${proto}://${host}`;

    // Read-only fetch of PUBLIC data (published products) — the sitemap is a
    // public document for crawlers and contains nothing private.
    const products = await base44.asServiceRole.entities.Product
      .filter({ status: "PUBLISHED" }, "-updated_date", 1000)
      .catch(() => []);
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].slice(0, 200);

    const entries = [];
    const add = (path, changefreq, priority, lastmod, images, title) =>
      entries.push({ path, changefreq, priority, lastmod, images, title });

    STATIC_PATHS.forEach((p) => add(p, "weekly", p === "/" ? "1.0" : "0.4"));
    CATEGORIES.forEach((c) => add(`/category?cat=${encodeURIComponent(c)}`, "daily", "0.7"));
    brands.forEach((b) => add(`/brand/${encodeURIComponent(b)}`, "daily", "0.6"));
    products.forEach((p) => {
      if (!p.slug) return;
      const images = [...new Set([p.image_url, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean))].slice(0, 6);
      add(`/product/${p.slug}`, "daily", "0.8", day(p.updated_date || p.last_crawled_at), images, p.name);
    });

    const urlBlock = (e) => {
      const loc = `${origin}${e.path}`;
      const lines = [`    <loc>${esc(loc)}</loc>`];
      if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
      lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
      lines.push(`    <priority>${e.priority}</priority>`);
      LANGUAGES.forEach((code) => {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${code}" href="${esc(`${origin}${withLang(e.path, code)}`)}"/>`);
      });
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc)}"/>`);
      (e.images || []).forEach((img) => {
        lines.push(
          `    <image:image><image:loc>${esc(img)}</image:loc>` +
          (e.title ? `<image:title>${esc(e.title)}</image:title>` : "") +
          `</image:image>`
        );
      });
      return `  <url>\n${lines.join("\n")}\n  </url>`;
    };

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
      '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n' +
      '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
      entries.map(urlBlock).join("\n") +
      "\n</urlset>";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || "Sitemap failed" }, { status: 500 });
  }
}