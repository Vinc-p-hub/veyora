import { sb, categoryPage, render } from "./_lib/ssr.js";

// /category?cat=Laptops → indexable category page. Search results (?q=) and faceted/sorted/paged
// variants are noindex,follow and canonicalise to the clean category URL (no duplicate-content dilution).
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const origin = url.origin;
  const sp = url.searchParams;
  const cat = (sp.get("cat") || "").slice(0, 80);
  const extra = [...sp.keys()].filter((k) => k !== "cat" && k !== "lang");

  try {
    if (sp.get("q")) {
      return render(context, { title: "Search results | VEYRO", description: "Search the VEYRO catalog of premium electronics.", url: `${origin}/category`, type: "website", jsonLd: [], body: "<main><h1>Search results</h1></main>", robots: "noindex, follow" });
    }
    let path = "products?status=eq.PUBLISHED&order=premium_score.desc&limit=48&select=slug,name,brand,customer_price,currency,image_url";
    if (cat) path += `&category=eq.${encodeURIComponent(cat)}`;
    const rows = await sb(context.env, path);
    return render(context, categoryPage(cat, rows, origin, { indexable: extra.length === 0 && rows.length > 0 }));
  } catch {
    return context.next();
  }
}
