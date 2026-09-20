// Abstract PSP layer — the single payment seam of the app.
// Adding a PSP = registering an adapter in PSP_PROVIDERS. The checkout and the
// order pipeline never talk to a provider directly: they create a PaymentIntent,
// and every state change arrives exclusively through a signed webhook.
// Secrets are read ONLY inside backend functions (passed in as arguments) —
// this module never reads base44:runtime itself.

// HMAC-SHA256 via Web Crypto (async — SubtleCrypto).
export async function hmacSha256Hex(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string comparison (no early exit on first differing byte).
export function timingSafeEqualHex(aHex, bHex) {
  if (typeof aHex !== "string" || typeof bHex !== "string" || aHex.length !== bHex.length) return false;
  let diff = 0;
  for (let i = 0; i < aHex.length; i++) diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  return diff === 0;
}

// Signed-webhook event -> normalized internal shape. Only fields VEYRO acts on.
export function normalizeWebhookEvent(json) {
  const d = (json && json.data) || {};
  return {
    external_id: String(json.id || json.event_id || json.eventId || ""),
    type: String(json.type || json.event || "unknown"),
    order_number: String(d.order_number || json.order_number || ""),
    payment_external_id: String(d.payment_id || d.paymentId || json.payment_id || ""),
    amount: d.amount != null || json.amount != null ? Number(d.amount != null ? d.amount : json.amount) : null,
    currency: String(d.currency || json.currency || ""),
    reason: String(d.reason || json.reason || ""),
    due_by: String(d.due_by || d.dueBy || ""),
  };
}

// Registry of PSP adapters. Each adapter declares how its webhooks are
// verified; outbound calls (create/refund) are wired per provider once its
// API contract is provided. onramp_veyro is webhook-driven: VEYRO creates the
// intent, the on-ramp system confirms it via the signed webhook.
export const PSP_PROVIDERS = {
  onramp_veyro: {
    id: "onramp_veyro",
    label: "PSP ON-RAMP VEYRO",
    signatureHeader: "x-veyro-signature",
    // Fail-closed HMAC verification of the raw request body.
    async verifySignature(rawBody, signature, webhookKey) {
      if (!webhookKey) return { ok: false, reason: "WEBHOOK_KEY_NOT_CONFIGURED" };
      if (!signature) return { ok: false, reason: "MISSING_SIGNATURE" };
      const received = signature.replace(/^sha256=/, "").trim();
      const expected = await hmacSha256Hex(webhookKey, rawBody);
      return timingSafeEqualHex(received, expected)
        ? { ok: true }
        : { ok: false, reason: "INVALID_SIGNATURE" };
    },
  },
};

export function getPsp(providerId) {
  return PSP_PROVIDERS[providerId] || null;
}

// Event type -> intent + order transitions. Order status stays untouched for
// refunds (the Order entity has no REFUNDED status; the refund lives on the
// intent and the Refund record).
export const EVENT_TRANSITIONS = {
  "payment.processing": { intent: "PROCESSING", order: "PENDING_PAYMENT" },
  "payment.succeeded": { intent: "SUCCEEDED", order: "PAID" },
  "payment.failed": { intent: "FAILED", order: "PAYMENT_FAILED" },
  "payment.cancelled": { intent: "CANCELLED", order: "CANCELLED" },
  "refund.succeeded": { intent: null, order: null },
  "dispute.opened": { intent: null, order: null },
};