// /llms.txt — a concise, factual map of the site for AI answer engines and assistants.
import { sb, CATEGORIES } from "./_lib/ssr.js";

export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  let brands = [];
  try {
    const rows = await sb(context.env, "products?status=eq.PUBLISHED&select=brand&limit=1000");
    const counts = {};
    for (const r of rows) if (r.brand) counts[r.brand] = (counts[r.brand] || 0) + 1;
    brands = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([b]) => b);
  } catch { /* categories alone are still useful */ }

  const body = `# VEYRO

> VEYRO is an international marketplace for premium electronics (smartphones, laptops, tablets, audio, gaming, smart home). Prices are shown as a total, stock is real, and customers can pay in installments with the total always visible. Guest checkout — no account required.

## Policies
- Returns: 30 days from delivery (${origin}/return-policy)
- Shipping and taxes calculated at checkout (${origin}/shipping-policy)
- Warranty: 2 years (${origin}/warranty)
- Support: ${origin}/support

## Browse
${CATEGORIES.map((c) => `- [${c}](${origin}/category?cat=${encodeURIComponent(c)})`).join("\n")}

## Brands
${brands.map((b) => `- [${b}](${origin}/brand/${encodeURIComponent(b)})`).join("\n")}

## Machine-readable
- Sitemap: ${origin}/sitemap.xml
- Every product page carries schema.org Product / Offer / BreadcrumbList JSON-LD.
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
