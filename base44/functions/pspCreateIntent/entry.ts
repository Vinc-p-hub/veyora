// Creates a PaymentIntent for an order through the abstract PSP registry.
// The intent is idempotent per order: one active intent per order at a time.
// The frontend NEVER receives payment confirmation here — confirmation only
// arrives via the signed PSP webhook (pspWebhook).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getPsp } from "../../shared/payments/psp.js";

const ACTIVE_INTENT_STATUSES = ["CREATED", "PENDING", "PROCESSING"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderNumber = String(body.order_number || "").slice(0, 64);
    const providerId = String(body.provider || "onramp_veyro").slice(0, 40);
    if (!orderNumber) return Response.json({ error: "order_number required" }, { status: 400 });
    const provider = getPsp(providerId);
    if (!provider) return Response.json({ error: "Unknown payment provider" }, { status: 400 });

    // Ownership enforced by RLS: a customer only ever sees their own orders.
    const orders = await base44.entities.Order.filter({ order_number: orderNumber }, null, 1);
    const order = orders[0];
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    const admin = base44.asServiceRole;
    const existing = await admin.entities.PaymentIntent.filter({ order_number: orderNumber }, "-created_date", 10);
    const active = existing.find((i) => ACTIVE_INTENT_STATUSES.includes(i.status));
    if (active) {
      return Response.json({
        ok: true,
        existing: true,
        intent: {
          id: active.id,
          provider: active.provider,
          status: active.status,
          amount: active.amount,
          currency: active.currency,
          payment_mode: active.payment_mode,
          down_payment: active.down_payment,
          installment_count: active.installment_count,
          installment_amount: active.installment_amount,
        },
      });
    }

    const idempotencyKey = `${orderNumber}:${order.total}:${order.currency}`;
    const created = await admin.entities.PaymentIntent.create({
      order_number: orderNumber,
      provider: providerId,
      amount: order.total,
      currency: order.currency || "USD",
      status: "CREATED",
      idempotency_key: idempotencyKey,
      payment_mode: order.installment_count > 0 ? "INSTALLMENTS" : "PAY_NOW",
      down_payment: order.down_payment != null ? order.down_payment : order.total,
      installment_count: order.installment_count || 0,
      installment_amount: order.installment_amount || 0,
      metadata: {
        country: order.country || null,
        customer_email: order.customer_email || null,
        payment_provider_requested: order.payment_provider || null,
      },
    });

    return Response.json({
      ok: true,
      existing: false,
      intent: {
        id: created.id,
        provider: providerId,
        status: created.status,
        amount: created.amount,
        currency: created.currency,
        payment_mode: created.payment_mode,
        down_payment: created.down_payment,
        installment_count: created.installment_count,
        installment_amount: created.installment_amount,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || "Failed to create payment intent" }, { status: 500 });
  }
}