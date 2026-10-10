// Server-side product search: synonyms, fuzzy/typo tolerance, facets, ranking by
// relevance + premium + availability, zero-result fallback. Logs every query for analytics.
import { serve, createContext, waitUntil } from "../_shared/runtime.ts";
import { searchCatalog } from "../_shared/search/engine.js";

function trim(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    customer_price: p.customer_price,
    currency: p.currency,
    image_url: p.image_url,
    stock_status: p.stock_status,
    premium_score: p.premium_score,
    premium_status: p.premium_status,
    rating: p.rating,
    reviews_count: p.reviews_count,
    delivery_days: p.delivery_days,
    available_countries: p.available_countries,
  };
}

serve(async (req) => {
  try {
    // Public: search must work for anonymous visitors (and crawlers' users).
    const { admin } = await createContext(req);
    const body = await req.json().catch(() => ({}));
    const q = String(body.q || "").slice(0, 120).trim();
    const country = String(body.country || "").toUpperCase().slice(0, 2);
    const mode = body.mode === "search" ? "search" : "suggest";
    const limit = Math.min(Number(body.limit) || (mode === "search" ? 60 : 8), 60);

    const products = await admin.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 500);
    const visible = country
      ? products.filter(
          (p) => !p.available_countries || !p.available_countries.length || p.available_countries.includes(country)
        )
      : products;

    const out = searchCatalog(visible, q, { limit, fallbackLimit: 12 });

    waitUntil(
      admin.entities.SearchQuery.create({
        query: q,
        country,
        mode,
        results_count: out.results.length,
      }).catch(() => {})
    );

    return Response.json({
      ok: true,
      mode,
      normalized_query: out.normalizedQuery,
      corrected: out.corrected,
      products: out.results.map(trim),
      brands: out.brands,
      categories: out.categories,
      fallback: out.fallback.map(trim),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Search failed" }, { status: 500 });
  }
});
