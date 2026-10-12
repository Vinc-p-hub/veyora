import { sb, homePage, render } from "./_lib/ssr.js";

// Home: crawlable links to categories, brands and top products (the SPA takes over in the browser).
export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  try {
    const products = await sb(context.env, "products?status=eq.PUBLISHED&order=premium_score.desc&limit=24&select=slug,name,brand,customer_price,currency,image_url");
    return render(context, homePage(origin, products));
  } catch {
    return context.next();
  }
}
