// PROMOTIONS engine — server authority for every discount. checkoutRevalidate
// applies it to each order; the storefront mirror (src/lib/promotions.js) only
// DISPLAYS the same AUTOMATIC promotions. COUPON codes are never publicly
// listed: they are validated here, server-side only.
import { round2 } from "./rules.js";

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

// Saving on ONE unit (USD), capped by max_discount_usd, never above the unit price.
export function unitDiscount(p, unitUsd) {
  const value = Number(p.value) || 0;
  let d = p.discount_type === "PERCENT" ? (unitUsd * value) / 100 : p.discount_type === "FIXED" ? value : 0;
  if (Number(p.max_discount_usd) > 0) d = Math.min(d, Number(p.max_discount_usd));
  return round2(Math.max(0, Math.min(d, unitUsd)));
}

// Best live AUTOMATIC price promotion for a product. `floorUsd` (supplier cost)
// guarantees a promotion never sells a product below what VEYRO pays for it.
export function bestAutoPromo(promos, product, unitUsd, { now = new Date(), floorUsd = 0 } = {}) {
  let best = null;
  for (const p of promos) {
    if (p.kind !== "AUTOMATIC" || p.discount_type === "FREE_SHIPPING") continue;
    if (!isPromoLive(p, now) || !promoMatches(p, product)) continue;
    let d = unitDiscount(p, unitUsd);
    if (floorUsd > 0) d = round2(Math.max(0, Math.min(d, unitUsd - floorUsd)));
    if (d > 0 && (!best || d > best.discount)) best = { promo: p, discount: d };
  }
  return best;
}

// Order-level promotions: coupon code + free shipping.
// lines: [{ product, line_total_usd }] — already net of automatic discounts.
export function evaluateOrderPromos(promos, { lines, subtotalUsd, couponCode, now = new Date() }) {
  const out = { coupon: null, coupon_discount_usd: 0, free_shipping: null };
  const code = String(couponCode || "").trim().toUpperCase();
  if (code) {
    const p = promos.find((x) => x.kind === "COUPON" && String(x.code || "").trim().toUpperCase() === code);
    const eligibleUsd = p
      ? round2(lines.filter((l) => promoMatches(p, l.product)).reduce((s, l) => s + l.line_total_usd, 0))
      : 0;
    if (!p || !isPromoLive(p, now)) {
      out.coupon = { code, valid: false, reason: "INVALID" };
    } else if (subtotalUsd < (Number(p.min_order_usd) || 0)) {
      out.coupon = { code, valid: false, reason: "MIN_ORDER" };
    } else if (eligibleUsd <= 0) {
      out.coupon = { code, valid: false, reason: "NOT_ELIGIBLE" };
    } else {
      out.coupon = { code, valid: true, promotion_id: p.id, label: p.label || p.name, discount_type: p.discount_type };
      if (p.discount_type === "FREE_SHIPPING") {
        out.free_shipping = p;
      } else {
        const value = Number(p.value) || 0;
        let d = p.discount_type === "PERCENT" ? (eligibleUsd * value) / 100 : value;
        if (Number(p.max_discount_usd) > 0) d = Math.min(d, Number(p.max_discount_usd));
        out.coupon_discount_usd = round2(Math.max(0, Math.min(d, eligibleUsd)));
      }
    }
  }
  if (!out.free_shipping) {
    out.free_shipping = promos.find((p) =>
      p.kind === "AUTOMATIC" && p.discount_type === "FREE_SHIPPING" && isPromoLive(p, now) &&
      subtotalUsd >= (Number(p.min_order_usd) || 0) && lines.some((l) => promoMatches(p, l.product))
    ) || null;
  }
  return out;
}