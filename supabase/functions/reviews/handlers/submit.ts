// Customer review submission & edit — server-authoritative.
// ABSOLUTE RULE: a review can only be created by a customer who actually
// bought the product (paid order containing it) or was explicitly invited by
// the VEYRO customer service team (invitation on file). verified_buyer is set here,
// server-side only — the client can never grant it. No review content is ever
// generated or altered by VEYRO.
//
// Guest checkout: a buyer WITHOUT an account proves the purchase with the order number + the
// e-mail used at checkout. Verified-buyer reviews that pass the automatic content screen are
// published immediately — positive or negative, nothing is filtered by sentiment. Only flagged content
// (links, contact details, insults, spam) waits for a moderator.
import { createContext } from "../../_shared/runtime.ts";

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

// "Marie Laurent" -> "Marie L." (never an e-mail, never a full surname).
const displayName = (full) => {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0].includes("@")) return null;
  const first = parts[0].slice(0, 24);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
};

export default async function(req) {
  try {
    const __ctx = await createContext(req);
    const user = __ctx.user; // optional: guests are welcome
    const admin = __ctx.admin;

    const body = await req.json();
    const productId = String(body.product_id || "");
    const rating = Math.round(Number(body.rating));
    const text = String(body.text || "").trim().slice(0, 2000);
    const title = String(body.title || "").trim().slice(0, 120);
    if (!productId) return Response.json({ error: "Missing product" }, { status: 400 });
    if (!(rating >= 1 && rating <= 5)) return Response.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    if (!text) return Response.json({ error: "Review text is required" }, { status: 400 });
    const photos = user
      ? (Array.isArray(body.photos) ? body.photos : []).filter((p) => typeof p === "string" && /^https?:\/\//.test(p)).slice(0, 3)
      : [];

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

    // ── Purchase verification ──
    // Signed-in: orders of the account or placed with the account's e-mail. Guest: order number + checkout e-mail.
    const containsProduct = (o) => (Array.isArray(o.items) ? o.items : []).some((it) => it.id === productId || it.product_id === productId);
    const eligible = (o) => ELIGIBLE_ORDER_STATUS.includes(o.status) && containsProduct(o);
    let candidates = [];
    const proofNumber = String(body.order_number || "").trim().toUpperCase();
    const proofEmail = String(body.email || "").trim().toLowerCase();
    if (proofNumber && proofEmail) {
      const o = (await admin.entities.Order.filter({ order_number: proofNumber }, null, 1))[0];
      if (o && String(o.customer_email || "").toLowerCase() === proofEmail) candidates.push(o);
    }
    if (user) {
      const byId = await admin.entities.Order.filter({ created_by_id: user.id }, "-created_date", 100);
      const mail = String(user.email || "").toLowerCase();
      const byMail = mail ? (await admin.entities.Order.filter({ customer_email: mail }, "-created_date", 100)) : [];
      candidates = [...candidates, ...byId, ...byMail];
    }
    const purchase = candidates.find(eligible);

    // No purchase: a customer-service invitation unlocks submission for a signed-in user only (kept moderated, never "verified").
    let invited = false;
    if (!purchase && user) {
      const invitations = await admin.entities.ReviewInvitation.filter(
        { product_id: productId, email: String(user.email || "").toLowerCase(), status: "PENDING" },
        "-created_date",
        20
      );
      invited = invitations.length > 0;
    }
    const allForProduct = await admin.entities.Review.filter({ product_id: productId }, "-created_date", 500);
    const mine = (r) => (user && r.created_by_id === user.id) || (purchase && r.order_number === purchase.order_number);
    const existing = allForProduct.find(mine);
    if (!purchase && !invited && !existing) {
      return Response.json({
        error: user
          ? "Purchase required: only customers who bought this product can review it."
          : "We could not match this order. Check the order number and the e-mail used at checkout (the order must be paid).",
      }, { status: 403 });
    }

    const flagReason = screenReview(`${title} ${text}`);
    // Verified buyers are published right away unless the content screen flags something.
    const autoPublish = setting("review_auto_publish", "true") === "true" && !!purchase && !flagReason;
    const status = autoPublish ? "PUBLISHED" : "PENDING";
    const author = displayName(purchase?.customer_name || user?.full_name);

    // Edit path (account holders): back to the same publication rule.
    if (body.review_id) {
      if (!existing || existing.id !== String(body.review_id)) {
        return Response.json({ error: "Review not found for this account" }, { status: 404 });
      }
      if (existing.status === "REJECTED") {
        return Response.json({ error: "This review was rejected and can no longer be edited." }, { status: 403 });
      }
      await admin.entities.Review.update(existing.id, {
        rating, title, text, photos, status, flag_reason: flagReason,
        edit_count: (existing.edit_count || 0) + 1, last_edited_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, status, updated: true });
    }
    if (existing) {
      return Response.json({ error: "You already reviewed this product." }, { status: 409 });
    }

    await admin.entities.Review.create({
      product_id: productId,
      product_slug: product.slug,
      rating, title, text, photos,
      author_name: author,
      verified_buyer: !!purchase,
      invited_buyer: !purchase,
      order_id: purchase ? purchase.id : null,
      order_number: purchase ? purchase.order_number : null,
      status,
      flag_reason: flagReason,
    });
    if (invited && user) {
      const invitations = await admin.entities.ReviewInvitation.filter(
        { product_id: productId, email: String(user.email || "").toLowerCase(), status: "PENDING" }, null, 20
      );
      for (const inv of invitations) {
        await admin.entities.ReviewInvitation.update(inv.id, { status: "USED", used_at: new Date().toISOString() });
      }
    }
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
