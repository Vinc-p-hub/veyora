// Creates a PaymentIntent for an order through the abstract PSP registry.
// The intent is idempotent per order: one active intent per order at a time.
// The frontend NEVER receives payment confirmation here — confirmation only
// arrives via the signed PSP webhook (pspWebhook).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { secrets } from "base44:runtime";
import { getPsp, normalizeNexapayCheckoutUrl } from "../../shared/payments/psp.js";

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
    if (active && !body.force_new) {
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
        // Hosted-checkout URL survives page reloads for NexaPay sessions.
        ...(active.provider === "nexapay" ? {
          nexapay: {
            checkout_url: normalizeNexapayCheckoutUrl((active.metadata && active.metadata.nexapay_checkout_url) || null),
            charge_amount:
              active.metadata && active.metadata.nexapay_charge_amount != null
                ? active.metadata.nexapay_charge_amount
                : active.amount,
          },
        } : {}),
      });
    }
    // Explicit retry: cancel the stale active intent, then start a fresh one.
    if (active && body.force_new) {
      await admin.entities.PaymentIntent.update(active.id, { status: "CANCELLED" });
    }

    // Amount actually charged today: the down payment on installment plans,
    // the full total otherwise. The signed webhook is validated against it.
    const chargeAmount =
      order.installment_count > 0 && order.down_payment != null ? order.down_payment : order.total;

    // NexaPay: create the hosted checkout session SERVER-SIDE with the
    // merchant secret key. If session creation fails, no intent is written.
    let nexapaySession = null;
    if (providerId === "nexapay") {
      const secretKey = secrets.get("NEXAPAY_SECRET_KEY");
      if (!secretKey) return Response.json({ error: "NEXAPAY_SECRET_KEY not configured" }, { status: 503 });
      try {
        nexapaySession = await provider.createCheckoutSession({
          secretKey,
          amount: chargeAmount,
          currency: order.currency || "USD",
          orderId: orderNumber,
          webhookUrl: "https://veyro-tech-prime.base44.app/functions/pspWebhook",
        });
      } catch (e) {
        return Response.json({ error: e.message || "NexaPay session creation failed" }, { status: 502 });
      }
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
        ...(nexapaySession ? {
          nexapay_session_id: nexapaySession.session_id || null,
          nexapay_charge_amount: chargeAmount,
          // Client-facing widget URL — by design safe for the customer;
          // merchant keys never leave the server.
          nexapay_checkout_url: nexapaySession.checkout_url,
        } : {}),
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
      ...(nexapaySession ? {
        nexapay: {
          session_id: nexapaySession.session_id,
          checkout_url: nexapaySession.checkout_url,
          client_secret: nexapaySession.client_secret,
          charge_amount: chargeAmount,
        },
      } : {}),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Failed to create payment intent" }, { status: 500 });
  }
}