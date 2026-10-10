import { sb, brandPage, render } from "../_lib/ssr.js";

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const brand = decodeURIComponent(String(context.params.brand || "")).slice(0, 80);
  try {
    // Case-insensitive exact match (escape LIKE wildcards).
    const safe = brand.replace(/[%_*\\]/g, "");
    const rows = await sb(context.env, `products?status=eq.PUBLISHED&brand=ilike.${encodeURIComponent(safe)}&order=premium_score.desc&limit=60&select=slug,name,brand,customer_price,currency,image_url`);
    if (!rows.length) return context.next();
    return render(context, brandPage(rows[0].brand || brand, rows, origin));
  } catch {
    return context.next();
  }
}
