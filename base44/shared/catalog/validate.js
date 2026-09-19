// Product validation — a missing OPTIONAL field never rejects a good product.
// Required: title, brand, price, currency, url. Everything else feeds the quality score.

export function validateProduct(p) {
  const missing = ["title", "brand", "price", "currency", "url"].filter((k) => !p[k]);
  const checks = {
    title: !!p.title,
    brand: !!p.brand,
    price: !!(p.price && p.price > 0),
    currency: !!p.currency,
    url: !!p.url,
    image: !!p.image,
    category: !!p.category,
    stock: !!p.stock_status && p.stock_status !== "UNKNOWN",
    identifiers: !!(p.gtin || p.mpn || p.sku || p.model),
    description: !!(p.description && p.description.length > 40),
  };
  const weights = {
    title: 0.2, brand: 0.1, price: 0.15, currency: 0.05, url: 0.1,
    image: 0.15, category: 0.1, stock: 0.05, identifiers: 0.05, description: 0.05,
  };
  const qualityScore = Object.keys(weights).reduce((s, k) => s + (checks[k] ? weights[k] : 0), 0);
  const status = missing.length > 0 ? "REVIEW" : qualityScore >= 0.65 ? "APPROVED" : "REVIEW";
  return { status, missing, qualityScore: Math.round(qualityScore * 100) / 100 };
}