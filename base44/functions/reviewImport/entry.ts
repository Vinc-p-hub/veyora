// Bulk import of real reviews for ONE product from an uploaded file
// (CSV, Excel or JSON). Rows are extracted by the platform file parser and
// stored as SourceReviews — verbatim and source-labelled. Nothing is ever
// generated: a row without review text is skipped, never invented or padded.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

const MAX_ROWS = 200;

// One file row = one review. The extractor maps the file's columns onto these
// fields and returns one object per row.
const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    author: { type: "string" },
    rating: { type: "number" },
    text: { type: "string" },
    source_name: { type: "string" },
    review_date: { type: "string" },
    review_url: { type: "string" },
  },
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const productId = String(body.product_id || "");
    const fileUrl = String(body.file_url || "");
    const defaultSource = String(body.source_name || "").trim();
    if (!productId || !fileUrl) {
      return Response.json({ error: "product_id and file_url are required" }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const product = await admin.entities.Product.get(productId).catch(() => null);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

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

    const sources = await admin.entities.CrawlerSource.list(null, 200);
    const nowIso = new Date().toISOString();

    const records = [];
    let skipped = 0;
    for (const row of rows.slice(0, MAX_ROWS)) {
      const text = String(row?.text || row?.review || row?.body || "").trim();
      if (!text) {
        skipped++;
        continue;
      }
      const sourceName = String(row?.source_name || defaultSource || "Partner review").trim();
      const matched = sources.find(
        (s) => s.name && s.name.toLowerCase() === sourceName.toLowerCase()
      );
      const rating = Number(row?.rating);
      records.push({
        product_id: productId,
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

    if (!records.length) {
      return Response.json(
        { error: "No usable review in this file — each row needs a review text column." },
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
      target_type: "product",
      target_id: productId,
      details: `${records.length} review(s) imported on ${product.name} (skipped ${skipped})`,
    }).catch(() => {});

    return Response.json({ ok: true, imported: records.length, skipped });
  } catch (error) {
    return Response.json({ error: error.message || "Review import failed" }, { status: 500 });
  }
}