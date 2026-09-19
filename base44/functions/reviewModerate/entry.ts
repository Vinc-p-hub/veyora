// Review moderation — Super Admin only. Approve / publish / reject / hide /
// delete customer reviews, hide/restore/delete imported source reviews.
// Every action is written to the AuditLog. Negative opinions are never a
// moderation reason: the admin supplies a reason that the system records.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CUSTOMER_ACTIONS = ["APPROVE", "PUBLISH", "REJECT", "HIDE", "RESTORE", "DELETE"];
const SOURCE_ACTIONS = ["HIDE", "RESTORE", "DELETE"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const scope = body.scope === "source" ? "source" : "customer";
    const action = String(body.action || "").toUpperCase();
    const reviewId = String(body.review_id || "");
    const reason = String(body.reason || "").slice(0, 300);
    const allowed = scope === "source" ? SOURCE_ACTIONS : CUSTOMER_ACTIONS;
    if (!allowed.includes(action)) return Response.json({ error: "Unknown action" }, { status: 400 });
    if (!reviewId) return Response.json({ error: "Missing review" }, { status: 400 });

    const admin = base44.asServiceRole;
    const nowIso = new Date().toISOString();

    if (scope === "source") {
      if (action === "DELETE") {
        await admin.entities.SourceReview.delete(reviewId);
      } else {
        await admin.entities.SourceReview.update(reviewId, {
          status: action === "HIDE" ? "HIDDEN" : "ACTIVE",
        });
      }
    } else {
      if (action === "DELETE") {
        await admin.entities.Review.delete(reviewId);
      } else {
        const patch = {
          moderated_by: user.email,
          moderated_at: nowIso,
          moderation_reason: action === "REJECT" || action === "HIDE" ? reason : null,
        };
        if (action === "APPROVE") patch.status = "APPROVED";
        if (action === "PUBLISH") patch.status = "PUBLISHED";
        if (action === "REJECT") patch.status = "REJECTED";
        if (action === "HIDE") patch.status = "HIDDEN";
        if (action === "RESTORE") {
          patch.status = "PUBLISHED";
          patch.moderation_reason = null;
        }
        await admin.entities.Review.update(reviewId, patch);
      }
    }

    // Audit trail — every validation, hide or removal is recorded.
    await admin.entities.AuditLog.create({
      actor_email: user.email,
      actor_id: user.id,
      action: `REVIEW_${scope.toUpperCase()}_${action}`,
      target_type: scope === "source" ? "source_review" : "review",
      target_id: reviewId,
      details: reason || "",
    });

    return Response.json({ ok: true, action, scope });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}