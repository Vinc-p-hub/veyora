import { sb, productPage, render } from "../_lib/ssr.js";

export async function onRequestGet(context) {
  const { params, request } = context;
  const origin = new URL(request.url).origin;
  const slug = decodeURIComponent(String(params.slug || ""));
  try {
    const rows = await sb(context.env, `products?slug=eq.${encodeURIComponent(slug)}&status=eq.PUBLISHED&limit=1`);
    if (!rows[0]) {
      // Unknown / unpublished product: real 404 so it never gets indexed.
      return render(context, { title: "Product not found | VEYRO", description: "This product is no longer available.", url: `${origin}/product/${encodeURIComponent(slug)}`, type: "website", jsonLd: [], body: "<main><h1>Product not found</h1><p><a href=\"/category\">Browse the catalog</a></p></main>" }, 404);
    }
    const p = rows[0];
    // Internal linking: strongest sibling products (same category, then same brand) help crawlers and users go deeper.
    let related = [];
    try {
      const sel = "select=slug,name,brand,customer_price,currency";
      const byCat = p.category ? await sb(context.env, `products?status=eq.PUBLISHED&category=eq.${encodeURIComponent(p.category)}&slug=neq.${encodeURIComponent(p.slug)}&order=premium_score.desc&limit=8&${sel}`) : [];
      related = byCat;
      if (related.length < 6 && p.brand) {
        const byBrand = await sb(context.env, `products?status=eq.PUBLISHED&brand=eq.${encodeURIComponent(p.brand)}&slug=neq.${encodeURIComponent(p.slug)}&order=premium_score.desc&limit=8&${sel}`);
        const seen = new Set(related.map((r) => r.slug));
        related = [...related, ...byBrand.filter((r) => !seen.has(r.slug))].slice(0, 8);
      }
    } catch { /* related links are a bonus */ }
    // First-party, published (moderated) reviews only — never imported third-party text.
    let reviews = [];
    try {
      reviews = await sb(context.env, `reviews?product_id=eq.${encodeURIComponent(p.id)}&status=eq.PUBLISHED&order=created_date.desc&limit=100&select=rating,title,text,created_date,verified_buyer`);
    } catch { /* no reviews block */ }
    return render(context, productPage(p, origin, related, reviews));
  } catch {
    return context.next(); // never break the app if the data source is unavailable
  }
}
