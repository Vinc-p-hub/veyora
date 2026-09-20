// Admin-only refund initiation through the abstract PSP layer.
// The Refund is recorded as PENDING and only becomes SUCCEEDED via the signed
// PSP webhook (refund.succeeded) — the frontend never confirms a refund.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getPsp } from "../../shared/payments/psp.js";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const orderNumber = String(body.order_number || "").slice(0, 64);
    const amount = Number(body.amount);
    const reason = String(body.reason || "CUSTOMER_REQUEST").slice(0, 40);
    const providerId = String(body.provider || "onramp_veyro").slice(0, 40);
    if (!orderNumber || !Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "order_number and a positive amount are required" }, { status: 400 });
    }
    if (!getPsp(providerId)) return Response.json({ error: "Unknown payment provider" }, { status: 400 });

    const admin = base44.asServiceRole;
    const intents = await admin.entities.PaymentIntent.filter({ order_number: orderNumber }, "-created_date", 5);
    const intent = intents.find((i) => i.status === "SUCCEEDED") || intents[0];
    if (!intent) return Response.json({ error: "No payment intent for this order" }, { status: 404 });
    // A refund can never exceed what was actually charged.
    if (amount > intent.amount + 0.01) {
      return Response.json({ error: `Amount exceeds the paid ${intent.amount} ${intent.currency}` }, { status: 400 });
    }

    const refund = await admin.entities.Refund.create({
      intent_id: intent.id,
      order_number: orderNumber,
      amount: Math.round(amount * 100) / 100,
      currency: intent.currency,
      reason,
      status: "PENDING",
      requested_by: user.email,
    });
    await admin.entities.AuditLog.create({
      actor_email: user.email,
      actor_id: user.id,
      action: "REFUND_INITIATED",
      target_type: "order",
      target_id: orderNumber,
      details: `amount=${refund.amount} ${refund.currency} reason=${reason} provider=${providerId}`,
    }).catch(() => {});

    return Response.json({
      ok: true,
      refund: {
        id: refund.id,
        order_number: orderNumber,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || "Refund failed" }, { status: 500 });
  }
}