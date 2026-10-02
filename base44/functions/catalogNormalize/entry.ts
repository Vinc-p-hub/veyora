// catalogNormalize — admin-only repair pass. Older catalog records kept the
// merchant's raw brand and free-form breadcrumb category verbatim ("Unknown",
// "SON", "PC Components > Motherboards > ASUS", Arabic breadcrumbs), which made
// them unfilterable and wrongly labelled on the storefront. This re-applies the
// current canonicalization in place. New crawls already run it — this only
// repairs what is already stored.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { normalizeBrand, canonicalCategory } from "../../shared/catalog/normalize.js";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const admin = base44.asServiceRole;
    const products = await admin.entities.Product.list(null, 1000);

    const updates = [];
    const samples = [];
    for (const p of products) {
      const brand = normalizeBrand(p.brand, p.name);
      // Same fallback as the crawler: an unmappable category becomes Accessories
      // rather than an unreadable breadcrumb ("غير مصنف").
      const category = canonicalCategory(p.category, p.name, brand) || "Accessories";
      const next = {};
      if (brand && brand !== p.brand) next.brand = brand;
      if (category && category !== p.category) next.category = category;
      if (Object.keys(next).length) {
        updates.push({ id: p.id, ...next });
        if (samples.length < 5) samples.push({ name: p.name.slice(0, 40), ...next });
      }
    }

    for (let i = 0; i < updates.length; i += 500) {
      await admin.entities.Product.bulkUpdate(updates.slice(i, i + 500));
    }

    return Response.json({ ok: true, scanned: products.length, updated: updates.length, samples });
  } catch (error) {
    return Response.json({ error: error.message || "Normalization failed" }, { status: 500 });
  }
}