// Product validation — only truly required fields block publication:
// title, price, currency, url (a category fallback is applied upstream).
// Everything else (brand, image, stock, GTIN/MPN, description, shipping)
// only feeds the quality score and never rejects a good product.

export function validateProduct(p) {
  const required = ["title", "price", "currency", "url"];
  const missing = required.filter((k) => !p[k]);
  const checks = {
    title: !!p.title,
    brand: !!p.brand,
    price: !!(p.price && p.price > 0),
    currency: !!p.currency,
    url: !!p.url,
    image: !!(p.image || (Array.isArray(p.gallery) && p.gallery.length)),
    category: !!p.category,
    stock: !!p.stock_status && p.stock_status !== "UNKNOWN",
    identifiers: !!(p.gtin || p.mpn || p.sku || p.model),
    description: !!(p.description && p.description.length > 40),
  };
  const weights = {
    title: 0.2, brand: 0.05, price: 0.15, currency: 0.05, url: 0.1,
    image: 0.15, category: 0.1, stock: 0.05, identifiers: 0.05, description: 0.1,
  };
  const qualityScore = Object.keys(weights).reduce((s, k) => s + (checks[k] ? weights[k] : 0), 0);
  const status = missing.length > 0 ? "REVIEW" : "APPROVED";
  return {
    status,
    missing,
    reason: missing.length ? `Missing required fields: ${missing.join(", ")}` : null,
    qualityScore: Math.round(qualityScore * 100) / 100,
  };
}