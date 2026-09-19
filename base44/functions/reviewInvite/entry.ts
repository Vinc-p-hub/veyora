// Customer-service review invitations — an admin invites a real buyer (by
// email) to share their honest experience on a product. This NEVER creates
// review content: it only unlocks review submission for the invited person,
// who must have a VEYRO account and writes their own review.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const APP_URL = "https://veyro-tech-prime.base44.app";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const productId = String(body.product_id || "");
    const emails = (Array.isArray(body.emails) ? body.emails : [body.emails])
      .map((e) => String(e || "").trim().toLowerCase())
      .filter((e) => EMAIL_RE.test(e))
      .slice(0, 10);
    if (!productId) return Response.json({ error: "Missing product" }, { status: 400 });
    if (emails.length === 0) return Response.json({ error: "Missing valid email" }, { status: 400 });

    const admin = base44.asServiceRole;
    let product = null;
    try {
      product = await admin.entities.Product.get(productId);
    } catch (_e) {
      /* not found below */
    }
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

    const results = [];
    for (const email of emails) {
      const invitation = await admin.entities.ReviewInvitation.create({
        product_id: productId,
        product_slug: product.slug,
        product_name: product.name,
        email,
        invited_by: user.email,
        status: "PENDING",
      });
      let emailSent = true;
      let emailError = null;
      try {
        await admin.integrations.Core.SendEmail({
          to: email,
          subject: `VEYRO — share your experience with ${product.name}`,
          text:
            "Hello,\n\n" +
            "Our customer service team invites you to share your honest experience with:\n" +
            `${product.name}\n${APP_URL}/product/${product.slug}\n\n` +
            "Sign in with this email address (a free VEYRO account), open the product page and write your review. " +
            "It will be published after moderation. Your opinion is entirely your own — VEYRO never writes or edits reviews.\n\n" +
            "Thank you,\nThe VEYRO team",
        });
      } catch (e) {
        emailSent = false;
        emailError = e.message;
      }
      await admin.entities.AuditLog.create({
        actor_email: user.email,
        actor_id: user.id,
        action: "review.invite",
        target_type: "ReviewInvitation",
        target_id: invitation.id,
        details: `Invited ${email} to review product ${product.name} (${productId})`,
      });
      results.push({ email, invitation_id: invitation.id, email_sent: emailSent, email_error: emailError });
    }

    return Response.json({ ok: true, invited: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}