// Real source-review import — shared by the crawler worker. Extracts only
// reviews that genuinely exist on the merchant page (schema.org JSON-LD
// `review` nodes). Nothing is generated, edited or invented: text, author,
// date and URL are kept verbatim from the source. Import is opt-in per source
// (CrawlerSource.reviews_enabled) because reuse permission is a legal decision.
// Deduplication key for a review across crawl runs.
export function sourceReviewFingerprint(review) {
  return (review.review_url && `url:${review.review_url}`) ||
    `t:${review.author}|${review.rating}|${review.text.slice(0, 80)}`;
}

// Upsert verbatim source reviews on a product. Never touches existing rows
// except for dedup — an imported review is immutable.
export async function importSourceReviews({ admin, source, productId, pageReviews, nowIso }) {
  if (!source.reviews_enabled || !pageReviews || !pageReviews.length) return { imported: 0 };
  const existing = await admin.entities.SourceReview.filter({ product_id: productId }, null, 50);
  const seen = new Set(existing.map((x) => x.review_url || `t:${x.author}|${x.rating}|${(x.text || "").slice(0, 80)}`));
  let imported = 0;
  for (const rv of pageReviews) {
    const fp = sourceReviewFingerprint(rv);
    if (seen.has(fp)) continue;
    seen.add(fp);
    await admin.entities.SourceReview.create({
      product_id: productId,
      source_id: source.id,
      source_name: source.name,
      author: rv.author,
      rating: rv.rating,
      text: rv.text,
      review_date: rv.review_date,
      review_url: rv.review_url,
      status: "ACTIVE",
      imported_at: nowIso,
    });
    imported++;
  }
  return { imported };
}