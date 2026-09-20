// Dynamic XML sitemap — real published catalog: static pages, legal pages,
// category landing pages, brand landing pages and every published product.
// Public endpoint intended for search engines: /functions/sitemap
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const origin = new URL(req.url).origin;

    // Read-only fetch of PUBLIC data (published products) — the sitemap is a
    // public document for crawlers and contains nothing private.
    const products = await base44.asServiceRole.entities.Product
      .filter({ status: "PUBLISHED" }, "-updated_date", 1000)
      .catch(() => []);
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].slice(0, 200);

    const urls = [];
    const add = (path, changefreq, priority) => urls.push({ path, changefreq, priority });
    STATIC_PATHS.forEach((p) => add(p, "weekly", p === "/" ? "1.0" : "0.4"));
    CATEGORIES.forEach((c) => add(`/category?cat=${encodeURIComponent(c)}`, "daily", "0.7"));
    brands.forEach((b) => add(`/brand/${encodeURIComponent(b)}`, "daily", "0.6"));
    products.forEach((p) => {
      if (p.slug) add(`/product/${p.slug}`, "daily", "0.8");
    });

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map((u) => `  <url><loc>${origin}${u.path}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
        .join("\n") +
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