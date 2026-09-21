// PSP webhook endpoint — the ONLY way a payment can be confirmed.
// Flow: SIGNATURE VERIFY -> IDEMPOTENCY -> TRANSACTION VALIDATION -> ORDER UPDATE.
// Fail-closed: without a configured webhook key, or with an invalid signature,
// nothing is processed. No user auth: authenticity comes from the HMAC signature.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { secrets } from "base44:runtime";
import { getPsp, normalizeWebhookEvent, EVENT_TRANSITIONS } from "../../shared/payments/psp.js";

export default async function (req) {
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (_e) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const admin = base44.asServiceRole;
  const rawBody = await req.text();

  // --- 1) SIGNATURE VERIFY (fail closed) ---
  // Provider dispatch: a NexaPay-Signature header routes to the NexaPay
  // contract (own signature scheme + own signing secret).
  const providerId = req.headers.get("nexapay-signature") ? "nexapay" : "onramp_veyro";
  let webhookKey;
  try {
    webhookKey = secrets.get(providerId === "nexapay" ? "NEXAPAY_WEBHOOK_SECRET" : "VEYRO_PSP_WEBHOOK_KEY");
  } catch (_e) {
    webhookKey = undefined; // missing secret -> fail closed below
  }
  const provider = getPsp(providerId);
  const signature =
    req.headers.get(provider.signatureHeader) ||
    (providerId === "nexapay" ? "" : req.headers.get("x-signature") || "");
  const check = await provider.verifySignature(rawBody, signature, webhookKey);
  if (!check.ok) {
    if (check.reason === "WEBHOOK_KEY_NOT_CONFIGURED") {
      return Response.json({ error: "Webhook key not configured — refusing all webhook traffic" }, { status: 503 });
    }
    await admin.entities.PspWebhookEvent.create({
      provider: providerId,
      event_type: "unknown",
      external_id: "unsigned_" + Date.now(),
      signature_valid: false,
      processed: false,
      status: "INVALID_SIGNATURE",
      error: check.reason,
    }).catch(() => {});
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // --- 2) PARSE + IDEMPOTENCY ---
  let payload;
  try {
    payload = normalizeWebhookEvent(JSON.parse(rawBody));
  } catch (_e) {
    await admin.entities.PspWebhookEvent.create({
      provider: providerId,
      event_type: "unknown",
      external_id: "malformed_" + Date.now(),
      signature_valid: true,
      processed: false,
      status: "INVALID_PAYLOAD",
      error: "Body is not valid JSON",
    }).catch(() => {});
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!payload.external_id || !payload.type) {
    return Response.json({ error: "Missing event id or type" }, { status: 400 });
  }

  const seen = await admin.entities.PspWebhookEvent.filter(
    { provider: providerId, external_id: payload.external_id },
    null,
    1
  );
  if (seen.length) {
    return Response.json({ ok: true, status: "DUPLICATE" });
  }

  const event = await admin.entities.PspWebhookEvent.create({
    provider: providerId,
    event_type: payload.type,
    external_id: payload.external_id,
    signature_valid: true,
    processed: false,
    status: "RECEIVED",
    order_number: payload.order_number || null,
    amount: payload.amount,
    currency: payload.currency || null,
  });

  // --- 3) TRANSACTION VALIDATION ---
  const transition = EVENT_TRANSITIONS[payload.type];
  if (!transition) {
    await admin.entities.PspWebhookEvent.update(event.id, {
      status: "ERROR",
      error: `Unknown event type ${payload.type}`,
    });
    return Response.json({ ok: true, status: "IGNORED" });
  }
  if (!payload.order_number) {
    await admin.entities.PspWebhookEvent.update(event.id, {
      status: "TRANSACTION_MISMATCH",
      error: "Event carries no order_number",
    });
    return Response.json({ ok: true, status: "REJECTED" });
  }

  const intents = await admin.entities.PaymentIntent.filter(
    { order_number: payload.order_number },
    "-created_date",
    5
  );
  const intent = intents[0];
  if (!intent) {
    await admin.entities.PspWebhookEvent.update(event.id, {
      status: "TRANSACTION_MISMATCH",
      error: "No PaymentIntent for this order",
    });
    return Response.json({ ok: true, status: "REJECTED" });
  }
  // Amount must match what the intent actually charges when the webhook
  // carries one — a signed webhook claiming a different amount never updates
  // the order. NexaPay charges the down payment on installment plans.
  const expectedAmount =
    intent.provider === "nexapay" && intent.metadata && intent.metadata.nexapay_charge_amount != null
      ? Number(intent.metadata.nexapay_charge_amount)
      : intent.amount;
  if (payload.amount != null && Math.abs(payload.amount - expectedAmount) > 0.01) {
    await admin.entities.PspWebhookEvent.update(event.id, {
      intent_id: intent.id,
      status: "TRANSACTION_MISMATCH",
      error: `Amount mismatch: webhook ${payload.amount} vs intent ${expectedAmount}`,
    });
    return Response.json({ ok: true, status: "REJECTED" });
  }

  // --- 4) ORDER UPDATE (idempotent, terminal statuses never overwritten) ---
  const nowIso = new Date().toISOString();
  if (transition.intent && intent.status !== "SUCCEEDED" && intent.status !== "REFUNDED") {
    await admin.entities.PaymentIntent.update(intent.id, {
      status: transition.intent,
      external_id: payload.payment_external_id || intent.external_id,
      confirmed_at: transition.intent === "SUCCEEDED" ? nowIso : intent.confirmed_at,
      failure_reason: transition.intent === "FAILED" ? payload.reason || "Payment failed" : intent.failure_reason,
    });
  }
  if (transition.order) {
    const orders = await admin.entities.Order.filter({ order_number: payload.order_number }, null, 1);
    if (orders[0]) {
      await admin.entities.Order.update(orders[0].id, { status: transition.order });
    }
  }
  if (payload.type === "refund.succeeded") {
    const refunds = await admin.entities.Refund.filter({ order_number: payload.order_number }, "-created_date", 5);
    const pending = refunds.find((r) => r.status === "PENDING" || r.status === "PROCESSING");
    if (pending) {
      await admin.entities.Refund.update(pending.id, {
        status: "SUCCEEDED",
        external_id: payload.payment_external_id || pending.external_id,
        processed_at: nowIso,
      });
    }
    if (intent.status !== "REFUNDED") {
      await admin.entities.PaymentIntent.update(intent.id, { status: "REFUNDED" });
    }
  }
  if (payload.type === "dispute.opened") {
    await admin.entities.Dispute.create({
      intent_id: intent.id,
      order_number: payload.order_number,
      provider: providerId,
      external_id: payload.payment_external_id || payload.external_id,
      amount: payload.amount != null ? payload.amount : intent.amount,
      currency: payload.currency || intent.currency,
      reason: payload.reason,
      status: "OPEN",
      due_by: payload.due_by || null,
    });
  }

  await admin.entities.PspWebhookEvent.update(event.id, {
    processed: true,
    status: "PROCESSED",
    intent_id: intent.id,
  });
  return Response.json({ ok: true, status: "PROCESSED" });
}