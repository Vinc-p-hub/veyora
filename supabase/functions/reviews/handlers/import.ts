// Bulk import of real reviews from an uploaded file (CSV, Excel or JSON).
// Two modes:
//   • single product — body.product_id is given, every row belongs to it;
//   • catalogue-wide — no product_id, each row names its product in the
//     `product` column (slug, exact name or SKU).
// Rows are extracted by the platform file parser and stored as SourceReviews —
// verbatim and source-labelled. Nothing is ever generated: a row without review
// text is skipped, and a row whose product cannot be matched is reported back
// instead of being dropped silently.
import { createContext, waitUntil } from "../../_shared/runtime.ts";

const MAX_ROWS_SINGLE = 200;
const MAX_ROWS_BULK = 500;

// One file row = one review. The extractor maps the file's columns onto these
// fields and returns one object per row.
const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    product: { type: "string" },
    author: { type: "string" },
    rating: { type: "number" },
    text: { type: "string" },
    source_name: { type: "string" },
    review_date: { type: "string" },
    review_url: { type: "string" },
  },
};

const norm = (v) => String(v || "").trim().toLowerCase();

export default async function handler(req: Request): Promise<Response> {
  try {
    const __ctx = await createContext(req);
    const user = __ctx.user;
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const productId = String(body.product_id || "");
    const fileUrl = String(body.file_url || "");
    const defaultSource = String(body.source_name || "").trim();
    if (!fileUrl) return Response.json({ error: "file_url is required" }, { status: 400 });

    const admin = __ctx.admin;
    const bulk = !productId;
    const maxRows = bulk ? MAX_ROWS_BULK : MAX_ROWS_SINGLE;

    let singleProduct = null;
    if (!bulk) {
      singleProduct = await admin.entities.Product.get(productId).catch(() => null);
      if (!singleProduct) return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const extracted = await admin.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: REVIEW_SCHEMA,
    });
    if (extracted.status !== "success") {
      return Response.json({ error: extracted.details || "The file could not be read" }, { status: 400 });
    }

    const out = extracted.output;
    const rows = Array.isArray(out)
      ? out
      : Array.isArray(out?.reviews)
        ? out.reviews
        : out && typeof out === "object"
          ? [out]
          : [];

    // Catalogue-wide mode: one lookup table for the whole file, keyed by slug,
    // exact name and SKU — a row never triggers its own product query.
    let bySlug = null;
    let byName = null;
    let bySku = null;
    if (bulk) {
      const products = await admin.entities.Product.list("-created_date", 5000);
      bySlug = new Map();
      byName = new Map();
      bySku = new Map();
      for (const p of products) {
        if (p.slug) bySlug.set(norm(p.slug), p);
        if (p.name) byName.set(norm(p.name), p);
        if (p.sku) bySku.set(norm(p.sku), p);
      }
    }

    const sources = await admin.entities.CrawlerSource.list(null, 200);
    const nowIso = new Date().toISOString();

    const records = [];
    const unmatched = new Set();
    let skipped = 0;
    for (const row of rows.slice(0, maxRows)) {
      const text = String(row?.text || row?.review || row?.body || "").trim();
      if (!text) {
        skipped++;
        continue;
      }

      let target = singleProduct;
      if (bulk) {
        const ref = norm(row?.product || row?.product_slug || row?.slug || row?.sku);
        target = ref ? bySlug.get(ref) || byName.get(ref) || bySku.get(ref) : null;
        if (!target) {
          unmatched.add(String(row?.product || row?.product_slug || row?.slug || "(empty)").trim() || "(empty)");
          continue;
        }
      }

      const sourceName = String(row?.source_name || defaultSource || "Partner review").trim();
      const matched = sources.find((s) => s.name && norm(s.name) === norm(sourceName));
      const rating = Number(row?.rating);
      records.push({
        product_id: target.id,
        source_id: matched?.id || "",
        source_name: sourceName,
        author: String(row?.author || row?.name || "Anonymous").trim() || "Anonymous",
        rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : 5,
        text,
        review_date: String(row?.review_date || row?.date || "").trim() || null,
        review_url: String(row?.review_url || row?.url || "").trim() || null,
        status: "ACTIVE",
        imported_at: nowIso,
      });
    }

    const unmatchedList = [...unmatched].slice(0, 10);
    if (!records.length) {
      return Response.json(
        {
          error: bulk
            ? "No usable review in this file — each row needs a review text and a product reference (slug, name or SKU) that matches the catalogue."
            : "No usable review in this file — each row needs a review text column.",
          unmatched: unmatchedList,
        },
        { status: 400 }
      );
    }

    for (let i = 0; i < records.length; i += 50) {
      await admin.entities.SourceReview.bulkCreate(records.slice(i, i + 50));
    }

    await admin.entities.AuditLog.create({
      actor_email: user.email,
      actor_id: user.id,
      action: "REVIEW_IMPORT",
      target_type: bulk ? "catalogue" : "product",
      target_id: bulk ? "bulk" : productId,
      details: bulk
        ? `${records.length} review(s) imported across the catalogue (skipped ${skipped}, unmatched ${unmatched.size})`
        : `${records.length} review(s) imported on ${singleProduct.name} (skipped ${skipped})`,
    }).catch(() => {});

    return Response.json({
      ok: true,
      imported: records.length,
      skipped,
      unmatched: unmatchedList,
      unmatched_count: unmatched.size,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Review import failed" }, { status: 500 });
  }
}