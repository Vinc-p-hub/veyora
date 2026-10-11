// Storefront mirror of the server promotions engine
// (supabase/functions/_shared/commerce/promotions.js). DISPLAY ONLY — checkoutRevalidate
// re-applies every promotion server-side before any order is written.

export function isPromoLive(p, now = new Date()) {
  if (!p || !p.active) return false;
  if (p.starts_at && new Date(p.starts_at) > now) return false;
  if (p.ends_at && new Date(p.ends_at) < now) return false;
  if (Number(p.usage_limit) > 0 && (Number(p.usage_count) || 0) >= Number(p.usage_limit)) return false;
  return true;
}

const lowerList = (arr) => (Array.isArray(arr) ? arr.map((x) => String(x).trim().toLowerCase()) : []);

export function promoMatches(p, product) {
  if (!product) return false;
  if (p.scope === "CATEGORY") return lowerList(p.categories).includes(String(product.category || "").toLowerCase());
  if (p.scope === "BRAND") return lowerList(p.brands).includes(String(product.brand || "").toLowerCase());
  if (p.scope === "PRODUCT") return Array.isArray(p.product_ids) && p.product_ids.includes(product.id);
  return true;
}

function unitDiscount(p, unit) {
  const value = Number(p.value) || 0;
  let d = p.discount_type === "PERCENT" ? (unit * value) / 100 : p.discount_type === "FIXED" ? value : 0;
  if (Number(p.max_discount_usd) > 0) d = Math.min(d, Number(p.max_discount_usd));
  return Math.round(Math.max(0, Math.min(d, unit)) * 100) / 100;
}

// Best live automatic price promotion → { promo, price, original, percent } | null
export function bestPromoFor(promos, product) {
  const unit = Number(product?.customer_price) || 0;
  if (!unit) return null;
  let best = null;
  for (const p of promos) {
    if (p.kind !== "AUTOMATIC" || p.discount_type === "FREE_SHIPPING") continue;
    if (!isPromoLive(p) || !promoMatches(p, product)) continue;
    const d = unitDiscount(p, unit);
    if (d > 0 && (!best || d > best.discount)) best = { promo: p, discount: d };
  }
  if (!best) return null;
  return {
    promo: best.promo,
    price: Math.round((unit - best.discount) * 100) / 100,
    original: unit,
    percent: Math.round((best.discount / unit) * 100),
  };
}

export function freeShippingFor(promos, product, amountUsd) {
  return promos.find((p) =>
    p.kind === "AUTOMATIC" && p.discount_type === "FREE_SHIPPING" && isPromoLive(p) &&
    promoMatches(p, product) && amountUsd >= (Number(p.min_order_usd) || 0)
  ) || null;
}

export function promoStatus(p, now = new Date()) {
  if (!p.active) return "PAUSED";
  if (p.starts_at && new Date(p.starts_at) > now) return "SCHEDULED";
  if (p.ends_at && new Date(p.ends_at) < now) return "EXPIRED";
  if (Number(p.usage_limit) > 0 && (Number(p.usage_count) || 0) >= Number(p.usage_limit)) return "EXHAUSTED";
  return "LIVE";
}

export function promoValueText(p) {
  if (p.discount_type === "FREE_SHIPPING") return "Free shipping";
  return p.discount_type === "PERCENT" ? `-${p.value}%` : `-$${p.value}`;
}