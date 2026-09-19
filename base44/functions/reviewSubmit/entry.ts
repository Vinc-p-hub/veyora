// Customer review submission & edit — server-authoritative.
// ABSOLUTE RULE: a review can only be created by a customer who actually
// bought the product (paid order containing it) or was explicitly invited by
// the VEYRO customer service team (invitation on file). verified_buyer is set here,
// server-side only — the client can never grant it. No review content is ever
// generated or altered by VEYRO.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ELIGIBLE_ORDER_STATUS = ["PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED"];

// Naive moderation pre-screen: flags suspicious content for the admin to
// review (spam, advertising links, personal data, insults). Informative only
// — it never publishes, deletes or rejects anything by itself.
function screenReview(text) {
  const flags = [];
  if (/https?:\/\/|www\.|\b(?:whatsapp|telegram|t\.me)\b/i.test(text)) flags.push("possible advertising (links)");
  if (/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i.test(text) || /\+?\d[\d\s().-]{7,}\d/.test(text)) flags.push("personal contact info");
  const lower = text.toLowerCase();
  const banned = ["fuck", "shit", "bitch", "asshole", "connard", "salope", "pute", "merde", "arnaque totale"];
  if (banned.some((w) => lower.includes(w))) flags.push("possible insult");
  if (/(.)\1{6,}/.test(text)) flags.push("spam pattern");
  const caps = text.replace(/[^A-Z ]/g, "");
  if (caps.length > 40 && caps.replace(/ /g, "").length > 30) flags.push("excessive caps");
  return flags.join(", ") || null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const productId = String(body.product_id || "");
    const rating = Math.round(Number(body.rating));
    const text = String(body.text || "").trim().slice(0, 2000);
    const title = String(body.title || "").trim().slice(0, 120);
    if (!productId) return Response.json({ error: "Missing product" }, { status: 400 });
    if (!(rating >= 1 && rating <= 5)) return Response.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    if (!text) return Response.json({ error: "Review text is required" }, { status: 400 });
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .filter((p) => typeof p === "string" && /^https?:\/\//.test(p))
      .slice(0, 3);

    const admin = base44.asServiceRole;
    const settings = await admin.entities.SiteSetting.list(null, 100);
    const setting = (key, fallback) => {
      const row = settings.find((s) => s.key === key);
      return row && row.value ? row.value : fallback;
    };
    if (setting("reviews_enabled", "true") !== "true") {
      return Response.json({ error: "Customer reviews are currently disabled" }, { status: 403 });
    }
    if (photos.length && setting("review_photos_enabled", "true") !== "true") {
      return Response.json({ error: "Review photos are currently disabled" }, { status: 403 });
    }

    let product = null;
    try {
      product = await admin.entities.Product.get(productId);
    } catch (_e) {
      /* not found below */
    }
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

    // Purchase verification — the customer must have a real paid order
    // containing this exact product. This is the Verified Buyer proof.
    const orders = await admin.entities.Order.filter({ created_by_id: user.id }, "-created_date", 100);
    const purchase = orders.find(
      (o) =>
        ELIGIBLE_ORDER_STATUS.includes(o.status) &&
        (Array.isArray(o.items) ? o.items : []).some((it) => it.id === productId || it.product_id === productId)
    );
    // No purchase: a customer-service invitation also unlocks submission — the
    // review is real (written by the invited person) but is NOT a Verified Buyer.
    let invited = false;
    if (!purchase) {
      const email = String(user.email || "").toLowerCase();
      const invitations = await admin.entities.ReviewInvitation.filter(
        { product_id: productId, email, status: "PENDING" },
        "-created_date",
        20
      );
      invited = invitations.length > 0;
      if (!invited) {
        // Editing one's own existing review stays allowed even when the
        // invitation has already been used.
        const own = (await admin.entities.Review.filter({ product_id: productId }, "-created_date", 100)).find(
          (r) => r.created_by_id === user.id
        );
        if (!own) {
          return Response.json({ error: "Purchase required: only customers who bought this product or invited buyers can review it." }, { status: 403 });
        }
      }
    }

    const flagReason = screenReview(`${title} ${text}`);
    const existing = (await admin.entities.Review.filter({ product_id: productId }, "-created_date", 100)).find(
      (r) => r.created_by_id === user.id
    );

    // Edit path: the author may update their own review; it goes back to
    // moderation (PENDING) and the verified status is re-checked implicitly
    // (purchase already verified above).
    if (body.review_id) {
      if (!existing || existing.id !== String(body.review_id)) {
        return Response.json({ error: "Review not found for this account" }, { status: 404 });
      }
      if (existing.status === "REJECTED") {
        return Response.json({ error: "This review was rejected and can no longer be edited." }, { status: 403 });
      }
      await admin.entities.Review.update(existing.id, {
        rating,
        title,
        text,
        photos,
        status: "PENDING",
        flag_reason: flagReason,
        edit_count: (existing.edit_count || 0) + 1,
        last_edited_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, status: "PENDING", updated: true });
    }

    if (existing) {
      return Response.json({ error: "You already reviewed this product — you can edit your existing review." }, { status: 409 });
    }

    await admin.entities.Review.create({
      product_id: productId,
      product_slug: product.slug,
      rating,
      title,
      text,
      photos,
      verified_buyer: !!purchase,
      invited_buyer: !purchase,
      order_id: purchase ? purchase.id : null,
      order_number: purchase ? purchase.order_number : null,
      status: "PENDING",
      flag_reason: flagReason,
    });
    if (invited) {
      const email = String(user.email || "").toLowerCase();
      const invitations = await admin.entities.ReviewInvitation.filter(
        { product_id: productId, email, status: "PENDING" },
        null,
        20
      );
      for (const inv of invitations) {
        await admin.entities.ReviewInvitation.update(inv.id, { status: "USED", used_at: new Date().toISOString() });
      }
    }
    return Response.json({ ok: true, status: "PENDING" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}