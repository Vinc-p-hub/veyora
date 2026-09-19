// Report a customer review — any authenticated user can flag a review for the
// admin moderation queue (spam, advertising, illegal, off-topic, fake…).
// The report itself never hides or deletes anything; the admin decides.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const reviewId = String(body.review_id || "");
    if (!reviewId) return Response.json({ error: "Missing review" }, { status: 400 });

    const admin = base44.asServiceRole;
    let review = null;
    try {
      review = await admin.entities.Review.get(reviewId);
    } catch (_e) {
      /* not found below */
    }
    if (!review) return Response.json({ error: "Review not found" }, { status: 404 });

    await admin.entities.Review.update(reviewId, {
      report_count: (review.report_count || 0) + 1,
      reported: true,
    });
    return Response.json({ ok: true, report_count: (review.report_count || 0) + 1 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}