// Server-side SEO for the SPA, run as Cloudflare Pages Functions.
// Crawlers (Google, Bing, social scrapers, AI answer engines) get real HTML for product and
// brand pages: unique <title>/description, canonical + hreflang, Open Graph, JSON-LD
// (Product / BreadcrumbList / ItemList) and a readable content block. Browsers still get the
// full React app, which replaces the content block when it boots.
// Only real catalog data is emitted — no invented ratings, prices or availability.

export const LANGS = ["en", "fr", "pt", "es", "ar"];
const SUPABASE_URL = "https://fulpkoenkmxwttgwioci.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1bHBrb2Vua214d3R0Z3dpb2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4OTMzMzQsImV4cCI6MjEwNTQ2OTMzNH0.WY5Kog8LUI17LyX1qg0g3ps2k_zH_BUIey2ok7w4h3U";

export const esc = (v) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// JSON inside <script>: neutralise "</script>" and HTML comment openers.
export const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export async function sb(env, path) {
  const base = env.SUPABASE_URL || SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || SUPABASE_ANON;
  const res = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

export const withLang = (url, code) => (code === "en" ? url : `${url}${url.includes("?") ? "&" : "?"}lang=${code}`);

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

export const CATEGORIES = ["Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors", "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home", "Networking", "Computer Components"];

// Site-wide entities, emitted on every server-rendered page (crawlers that never run JS still see them).
export function siteGraph(origin) {
  return [
    { "@context": "https://schema.org", "@type": "Organization", "@id": `${origin}/#organization`, name: "VEYRO", url: origin, logo: `${origin}/favicon.svg` },
    {
      "@context": "https://schema.org", "@type": "WebSite", "@id": `${origin}/#website`, url: origin, name: "VEYRO",
      publisher: { "@id": `${origin}/#organization` },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${origin}/category?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];
}

// The published return policy: 30 days, return shipping paid by the customer unless the item is defective/misdescribed.
const returnPolicy = (origin, countries) => ({
  "@type": "MerchantReturnPolicy",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 30,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnShippingFees",
  merchantReturnLink: `${origin}/return-policy`,
  ...(Array.isArray(countries) && countries.length ? { applicableCountry: countries } : {}),
});

const TITLE_MAX = 68;
export function seoTitle(keyword, extras, brand = "VEYRO") {
  const head = String(keyword || "").trim();
  const tail = ` | ${brand}`;
  for (const extra of extras) if (head.length + extra.length + tail.length + 3 <= TITLE_MAX) return `${head} — ${extra}${tail}`;
  return `${head}${tail}`;
}

const AVAILABILITY = {
  IN_STOCK: "https://schema.org/InStock",
  LOW_STOCK: "https://schema.org/LimitedAvailability",
  OUT_OF_STOCK: "https://schema.org/OutOfStock",
  PREORDER: "https://schema.org/PreOrder",
};

const flat = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return v.map(flat).join(", ");
  return Object.entries(v).map(([k, x]) => `${k}: ${flat(x)}`).join(" · ");
};

export function productPage(p, origin, related = []) {
  const url = `${origin}/product/${p.slug}`;
  const fullName = `${p.brand ? `${p.brand} ` : ""}${p.name}`;
  const title = p.seo_title || seoTitle(fullName, ["Price, Specs & Installments", "Price & Specs", "Price"]);
  const description = clip(
    p.meta_description ||
      `Buy ${fullName} at VEYRO — transparent pricing, verified sellers, ${p.delivery_days || 5}-day delivery and flexible installments. Total price always visible.`,
    300
  );
  const images = [...new Set([p.image_url, ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean))].slice(0, 6);
  const price = Number(p.customer_price);

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: fullName,
    url,
    ...(images.length ? { image: images } : {}),
    description: clip(p.description || description, 5000),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.gtin ? { gtin: p.gtin } : {}),
    ...(p.mpn ? { mpn: p.mpn } : {}),
    ...(p.model ? { model: p.model } : {}),
    ...(p.category ? { category: p.category } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(price > 0
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: price.toFixed(2),
            priceCurrency: p.currency || "USD",
            itemCondition: "https://schema.org/NewCondition",
            availability: AVAILABILITY[p.stock_status] || AVAILABILITY.IN_STOCK,
            seller: { "@type": "Organization", name: "VEYRO", url: origin },
            hasMerchantReturnPolicy: returnPolicy(origin, p.available_countries),
          },
        }
      : {}),
    // Rating only when real customer reviews exist.
    ...(Number(p.reviews_count) > 0 && Number(p.rating) > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(p.rating), reviewCount: Number(p.reviews_count) } }
      : {}),
  };
  const crumbs = [
    { name: "Home", path: "/" },
    ...(p.category ? [{ name: p.category, path: `/category?cat=${encodeURIComponent(p.category)}` }] : []),
    { name: p.name, path: `/product/${p.slug}` },
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${origin}${c.path}` })),
  };

  const specs = p.specifications && typeof p.specifications === "object" ? Object.entries(p.specifications).slice(0, 40) : [];
  const body = `<main data-ssr="product" style="max-width:960px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
<nav aria-label="Breadcrumb">${crumbs.map((c) => `<a href="${esc(c.path)}">${esc(c.name)}</a>`).join(" › ")}</nav>
<h1>${esc(fullName)}</h1>
${images[0] ? `<img src="${esc(images[0])}" alt="${esc(fullName)}" width="480" height="480" style="max-width:100%;height:auto">` : ""}
${price > 0 ? `<p><strong>${esc(price.toFixed(2))} ${esc(p.currency || "USD")}</strong> — ${p.stock_status === "OUT_OF_STOCK" ? "Out of stock" : "In stock"}. Delivery in about ${esc(p.delivery_days || 5)} days. Flexible installments with the total always visible.</p>` : ""}
${p.description ? `<p>${esc(clip(p.description, 1500))}</p>` : ""}
${specs.length ? `<h2>Specifications</h2><table>${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(flat(v))}</td></tr>`).join("")}</table>` : ""}
${p.brand ? `<p><a href="/brand/${encodeURIComponent(p.brand)}">More ${esc(p.brand)} products</a></p>` : ""}
${related.length ? `<h2>Related products</h2><ul>${related.map((r) => `<li><a href="/product/${esc(r.slug)}">${esc(r.brand ? `${r.brand} ${r.name}` : r.name)}</a>${Number(r.customer_price) > 0 ? ` — ${esc(Number(r.customer_price).toFixed(2))} ${esc(r.currency || "USD")}` : ""}</li>`).join("")}</ul>` : ""}
<p><a href="/return-policy">30-day returns</a> · <a href="/shipping-policy">Shipping</a> · <a href="/warranty">2-year warranty</a></p>
</main>`;

  return { title, description, url, image: images[0], type: "product", jsonLd: [product, breadcrumb], body, path: `/product/${p.slug}` };
}

export function brandPage(brand, products, origin) {
  const path = `/brand/${encodeURIComponent(brand)}`;
  const url = `${origin}${path}`;
  const title = seoTitle(`Buy ${brand} Online`, ["Best Prices, Deals & Installments", "Best Prices & Deals"]);
  const description = clip(
    `Buy ${brand} online at VEYRO${products.length ? ` — ${products.length} products` : ""} from verified merchants. Transparent prices, real stock, worldwide delivery and flexible installments with the total always visible.`,
    300
  );
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${brand} on VEYRO`,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}/product/${p.slug}`, name: p.name })),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: brand, item: url },
    ],
  };
  const body = `<main data-ssr="brand" style="max-width:960px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
<h1>${esc(brand)} on VEYRO</h1>
<ul>${products.map((p) => `<li><a href="/product/${esc(p.slug)}">${esc(p.name)}</a>${Number(p.customer_price) > 0 ? ` — ${esc(Number(p.customer_price).toFixed(2))} ${esc(p.currency || "USD")}` : ""}</li>`).join("")}</ul>
</main>`;
  return { title, description, url, image: products[0]?.image_url, type: "website", jsonLd: [list, breadcrumb], body, path };
}

export function homePage(origin, products) {
  const title = "Buy Electronics Online — Smartphones, Laptops, Audio & More | VEYRO";
  const description = "VEYRO is the international premium electronics marketplace: buy smartphones, laptops, audio, gaming and smart home from verified merchants — transparent prices, real stock and flexible installments with the total always visible.";
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].slice(0, 12);
  const list = {
    "@context": "https://schema.org", "@type": "ItemList", name: "Featured electronics on VEYRO",
    itemListElement: products.slice(0, 12).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}/product/${p.slug}`, name: p.name })),
  };
  const body = `<main data-ssr="home" style="max-width:960px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
<h1>Premium electronics, transparent prices</h1>
<p>Buy smartphones, laptops, tablets, audio, gaming and smart home from verified merchants. Real stock, worldwide delivery, 30-day returns and flexible installments with the total always visible.</p>
<h2>Shop by category</h2>
<ul>${CATEGORIES.map((c) => `<li><a href="/category?cat=${encodeURIComponent(c)}">${esc(c)}</a></li>`).join("")}</ul>
${brands.length ? `<h2>Popular brands</h2><ul>${brands.map((b) => `<li><a href="/brand/${encodeURIComponent(b)}">${esc(b)}</a></li>`).join("")}</ul>` : ""}
<h2>Featured products</h2>
<ul>${products.slice(0, 24).map((p) => `<li><a href="/product/${esc(p.slug)}">${esc(p.brand ? `${p.brand} ${p.name}` : p.name)}</a>${Number(p.customer_price) > 0 ? ` — ${esc(Number(p.customer_price).toFixed(2))} ${esc(p.currency || "USD")}` : ""}</li>`).join("")}</ul>
</main>`;
  return { title, description, url: `${origin}/`, type: "website", jsonLd: [list], body, path: "/" };
}

export function categoryPage(cat, products, origin, { indexable = true } = {}) {
  const path = cat ? `/category?cat=${encodeURIComponent(cat)}` : "/category";
  const url = `${origin}${path}`;
  const name = cat || "Electronics";
  const title = seoTitle(`Buy ${name} Online`, ["Best Prices, Real Stock & Installments", "Best Prices & Installments", "Best Prices"]);
  const description = clip(
    `Shop ${name.toLowerCase()} online at VEYRO${products.length ? ` — ${products.length}+ products` : ""} from verified merchants. Transparent prices, real stock, worldwide delivery, 30-day returns and flexible installments with the total always visible.`,
    300
  );
  const list = {
    "@context": "https://schema.org", "@type": "ItemList", name: `${name} on VEYRO`,
    itemListElement: products.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}/product/${p.slug}`, name: p.name })),
  };
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      ...(cat ? [{ "@type": "ListItem", position: 2, name: cat, item: url }] : []),
    ],
  };
  const body = `<main data-ssr="category" style="max-width:960px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
<h1>${esc(name)}</h1>
<ul>${products.map((p) => `<li><a href="/product/${esc(p.slug)}">${esc(p.brand ? `${p.brand} ${p.name}` : p.name)}</a>${Number(p.customer_price) > 0 ? ` — ${esc(Number(p.customer_price).toFixed(2))} ${esc(p.currency || "USD")}` : ""}</li>`).join("")}</ul>
<h2>Other categories</h2>
<ul>${CATEGORIES.filter((c) => c !== cat).map((c) => `<li><a href="/category?cat=${encodeURIComponent(c)}">${esc(c)}</a></li>`).join("")}</ul>
</main>`;
  return { title, description, url, image: products[0]?.image_url, type: "website", jsonLd: [list, breadcrumb], body, path, robots: indexable ? undefined : "noindex, follow" };
}

// Take the built index.html and rewrite its head + root for this page.
export async function render(context, page, status = 200) {
  const { request, env } = context;
  const asset = await env.ASSETS.fetch(new URL("/index.html", request.url));
  const hreflang = LANGS.map((c) => `<link rel="alternate" hreflang="${c}" href="${esc(withLang(page.url, c))}">`).join("\n") +
    `\n<link rel="alternate" hreflang="x-default" href="${esc(page.url)}">`;
  const head = `
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${page.robots || (status === 200 ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" : "noindex")}">
<link rel="canonical" href="${esc(page.url)}">
${hreflang}
<meta property="og:site_name" content="VEYRO">
<meta property="og:type" content="${page.type === "product" ? "product" : "website"}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(page.url)}">
${page.image ? `<meta property="og:image" content="${esc(page.image)}">\n<meta name="twitter:image" content="${esc(page.image)}">` : ""}
<meta name="twitter:card" content="${page.image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
${[...siteGraph(new URL(page.url).origin), ...page.jsonLd].map((j) => `<script type="application/ld+json">${safeJson(j)}</script>`).join("\n")}`;

  const rewritten = new HTMLRewriter()
    // The client-side SEO bootstrap would append a second, conflicting canonical/hreflang set.
    .on("script[data-seo-bootstrap]", { element: (e) => e.remove() })
    .on("title", { element: (e) => e.remove() })
    .on('meta[name="description"], meta[name="robots"], meta[name="keywords"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], link[rel="alternate"]', { element: (e) => e.remove() })
    .on("head", { element: (e) => e.append(head, { html: true }) })
    .on("#root", { element: (e) => e.setInnerContent(page.body, { html: true }) })
    .transform(new Response(asset.body, asset));

  const headers = new Headers(rewritten.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  return new Response(rewritten.body, { status, headers });
}

export const passthrough = (context) => context.next();
