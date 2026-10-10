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
    return render(context, productPage(rows[0], origin));
  } catch {
    return context.next(); // never break the app if the data source is unavailable
  }
}
