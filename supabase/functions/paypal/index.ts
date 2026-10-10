// PayPal Checkout (Orders v2) — server side. The browser never decides what is paid:
// amounts come from the `orders` row, and an order only becomes PAID after PayPal
// reports a COMPLETED capture whose amount/currency match the intent stored at creation.
//
// Secrets (Supabase → Edge Functions → Secrets): PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
// PAYPAL_ENV = "sandbox" | "live" (default sandbox).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PAYPAL_CURRENCIES = new Set([
  "AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", "ILS", "JPY", "MYR", "MXN", "TWD",
  "NZD", "NOK", "PHP", "PLN", "GBP", "SGD", "SEK", "CHF", "THB", "USD",
]);
const NO_DECIMALS = new Set(["JPY", "HUF", "TWD"]);

const clientId = () => Deno.env.get("PAYPAL_CLIENT_ID") || "";
const clientSecret = () => Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const baseUrl = () =>
  (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
const configured = () => !!clientId() && !!clientSecret();

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

async function accessToken(): Promise<string> {
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${clientId()}:${clientSecret()}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal authentication failed");
  return (await res.json()).access_token;
}

const fmt = (amount: number, currency: string) =>
  NO_DECIMALS.has(currency) ? Math.round(amount).toString() : (Math.round(amount * 100) / 100).toFixed(2);

async function createOrder(orderNumber: string) {
  const db = admin();
  const { data: order, error } = await db.from("orders").select("*").eq("order_number", orderNumber).maybeSingle();
  if (error || !order) return json({ ok: false, error: "Order not found" }, 404);
  if (order.status !== "PENDING_PAYMENT") return json({ ok: false, error: "Order is not awaiting payment" }, 409);

  const total = Number(order.total);
  if (!(total > 0)) return json({ ok: false, error: "Invalid order total" }, 400);

  // Amount due now: the down payment for instalment plans, the full total otherwise.
  const down = Number(order.down_payment) || 0;
  const dueNow = Number(order.installment_count) > 0 && down > 0 ? Math.min(down, total) : total;

  // PayPal cannot charge every currency (AED, NGN, XOF, ...): bill in USD at the platform rate.
  let currency = String(order.currency || "USD").toUpperCase();
  let amount = dueNow;
  let converted = false;
  if (!PAYPAL_CURRENCIES.has(currency)) {
    const { data: rateRow } = await db.from("currency_rates").select("rate").eq("code", currency).maybeSingle();
    const rate = Number(rateRow?.rate);
    if (!(rate > 0)) return json({ ok: false, error: `PayPal does not support ${currency}` }, 400);
    amount = dueNow / rate;
    currency = "USD";
    converted = true;
  }
  const value = fmt(amount, currency);

  const token = await accessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: orderNumber,
        custom_id: orderNumber,
        description: `VEYRO order ${orderNumber}`,
        amount: { currency_code: currency, value },
      }],
      payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } },
    }),
  });
  const pp = await res.json();
  if (!res.ok || !pp.id) return json({ ok: false, error: pp.message || "PayPal order creation failed" }, 502);

  await db.from("payment_intents").insert({
    order_number: orderNumber,
    provider: "paypal",
    amount: Number(value),
    currency,
    status: "CREATED",
    external_id: pp.id,
    payment_mode: dueNow < total ? "INSTALLMENT" : "PAY_NOW",
    down_payment: dueNow < total ? dueNow : null,
    metadata: { order_total: total, order_currency: order.currency, due_now: dueNow, converted },
  });

  return json({ ok: true, paypal_order_id: pp.id, client_id: clientId(), currency, amount: Number(value), converted });
}

async function captureOrder(paypalOrderId: string) {
  const db = admin();
  const { data: intent } = await db.from("payment_intents").select("*").eq("external_id", paypalOrderId).eq("provider", "paypal").maybeSingle();
  if (!intent) return json({ ok: false, error: "Unknown PayPal order" }, 404);
  if (intent.status === "SUCCEEDED") return json({ ok: true, order_number: intent.order_number, already: true });
  if (!["CREATED", "PENDING", "PROCESSING"].includes(intent.status)) return json({ ok: false, error: "Payment cannot be captured" }, 409);

  const token = await accessToken();
  const res = await fetch(`${baseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `cap-${paypalOrderId}` },
  });
  const pp = await res.json();
  const capture = pp?.purchase_units?.[0]?.payments?.captures?.[0];

  if (!res.ok || !capture) {
    await db.from("payment_intents").update({ status: "FAILED", failure_reason: pp?.message || pp?.name || "capture_failed" }).eq("id", intent.id);
    return json({ ok: false, error: pp?.details?.[0]?.description || pp?.message || "Payment could not be captured" }, 402);
  }

  if (capture.status !== "COMPLETED") {
    await db.from("payment_intents").update({ status: "PROCESSING", metadata: { ...(intent.metadata || {}), capture_id: capture.id, capture_status: capture.status } }).eq("id", intent.id);
    return json({ ok: true, pending: true, order_number: intent.order_number, status: capture.status });
  }

  // Never trust the client or the PayPal payload blindly: amount + currency must match what we asked for.
  const paid = Number(capture.amount?.value);
  const sameAmount = Math.abs(paid - Number(intent.amount)) < 0.005;
  const sameCurrency = String(capture.amount?.currency_code).toUpperCase() === String(intent.currency).toUpperCase();
  if (!sameAmount || !sameCurrency) {
    await db.from("payment_intents").update({ status: "FAILED", failure_reason: "amount_mismatch", metadata: { ...(intent.metadata || {}), capture_id: capture.id, paid, paid_currency: capture.amount?.currency_code } }).eq("id", intent.id);
    return json({ ok: false, error: "Payment amount mismatch — flagged for review" }, 409);
  }

  await db.from("payment_intents").update({
    status: "SUCCEEDED", confirmed_at: new Date().toISOString(),
    metadata: { ...(intent.metadata || {}), capture_id: capture.id, payer_email: pp?.payer?.email_address || null },
  }).eq("id", intent.id);
  await db.from("orders").update({ status: "PAID" }).eq("order_number", intent.order_number).eq("status", "PENDING_PAYMENT");

  return json({ ok: true, order_number: intent.order_number });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "providers") {
      return json({ ok: true, providers: configured() ? [{ id: "paypal", label: "PayPal", region: "Global" }] : [] });
    }
    if (!configured()) return json({ ok: false, error: "PayPal is not configured" }, 503);

    if (action === "create_order") {
      const orderNumber = String(body.order_number || "");
      if (!/^[A-Z0-9-]{4,40}$/.test(orderNumber)) return json({ ok: false, error: "Invalid order number" }, 400);
      return await createOrder(orderNumber);
    }
    if (action === "capture_order") {
      const id = String(body.paypal_order_id || "");
      if (!/^[A-Z0-9]{10,30}$/.test(id)) return json({ ok: false, error: "Invalid PayPal order id" }, 400);
      return await captureOrder(id);
    }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    console.error("paypal function error", e);
    return json({ ok: false, error: "Payment service error" }, 500);
  }
});
