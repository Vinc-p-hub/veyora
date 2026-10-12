// Payments — embedded checkouts with NO redirect: PayPal (JS SDK), Stripe (Payment Element,
// redirect-based methods disabled) and Paystack (inline popup).
// Credentials are entered by a super admin in the back office and stored AES-GCM encrypted in
// public.psp_credentials (key in public.app_secrets). They never travel back to a browser.
// An order only becomes PAID after the provider confirms the payment server-side with a
// matching amount and currency — the browser's word is never enough.
import { serve, createContext } from "../_shared/runtime.ts";

// ───────────────────────────── provider catalog ─────────────────────────────
type Field = { key: string; label: string; secret: boolean; required: boolean; placeholder?: string };
const PROVIDERS: Record<string, { label: string; region: string; desc: string; docs: string; fields: Field[] }> = {
  paypal: {
    label: "PayPal", region: "Global", desc: "PayPal balance & cards — embedded, no redirect",
    docs: "https://developer.paypal.com/dashboard/applications",
    fields: [
      { key: "client_id", label: "Client ID", secret: false, required: true },
      { key: "client_secret", label: "Client Secret", secret: true, required: true },
    ],
  },
  stripe: {
    label: "Stripe", region: "Global", desc: "Cards, Apple Pay, Google Pay — embedded, no redirect",
    docs: "https://dashboard.stripe.com/apikeys",
    fields: [
      { key: "publishable_key", label: "Publishable key", secret: false, required: true, placeholder: "pk_live_…" },
      { key: "secret_key", label: "Secret key", secret: true, required: true, placeholder: "sk_live_… or rk_live_…" },
      { key: "webhook_secret", label: "Webhook signing secret", secret: true, required: false, placeholder: "whsec_… (recommended)" },
    ],
  },
  nexapay: {
    label: "NexaPay", region: "Global", desc: "Card & Mobile Money — secure embedded checkout, no redirect",
    docs: "https://thankful-nexa-pay-flow.base44.app",
    fields: [
      { key: "secret_key", label: "Merchant secret key", secret: true, required: true },
      { key: "webhook_secret", label: "Webhook signing secret", secret: true, required: true },
    ],
  },
  paystack: {
    label: "Paystack", region: "Africa", desc: "Cards, bank & mobile money — inline popup, no redirect",
    docs: "https://dashboard.paystack.com/#/settings/developers",
    fields: [
      { key: "public_key", label: "Public key", secret: false, required: true, placeholder: "pk_live_…" },
      { key: "secret_key", label: "Secret key", secret: true, required: true, placeholder: "sk_live_…" },
    ],
  },
};

const PAYPAL_CURRENCIES = new Set(["AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS","JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD","SEK","CHF","THB","USD"]);
const PAYPAL_NO_DECIMALS = new Set(["JPY", "HUF", "TWD"]);
const STRIPE_ZERO_DECIMAL = new Set(["BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"]);
const PAYSTACK_CURRENCIES = new Set(["NGN", "GHS", "ZAR", "KES", "USD"]);

const json = (b: unknown, status = 200) => Response.json(b, { status });
const mask = (v: string) => (v.length <= 8 ? "••••" : "••••" + v.slice(-4));

// ───────────────────────────── encrypted vault ──────────────────────────────
const hex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// deno-lint-ignore no-explicit-any
async function vaultKey(db: any) {
  const { data } = await db.from("app_secrets").select("value").eq("key", "psp_enc_key").maybeSingle();
  if (!data?.value) throw new Error("Vault key missing");
  return crypto.subtle.importKey("raw", hex(String(data.value).slice(0, 64)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
// deno-lint-ignore no-explicit-any
async function encrypt(db: any, obj: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await vaultKey(db), new TextEncoder().encode(JSON.stringify(obj))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64(out);
}
// deno-lint-ignore no-explicit-any
async function decrypt(db: any, blob: string): Promise<Record<string, string>> {
  const raw = unb64(blob);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await vaultKey(db), raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

// deno-lint-ignore no-explicit-any
async function loadProvider(db: any, id: string) {
  const { data: row } = await db.from("psp_credentials").select("*").eq("provider", id).maybeSingle();
  let creds: Record<string, string> = {};
  if (row?.credentials?.enc) { try { creds = await decrypt(db, row.credentials.enc); } catch { creds = {}; } }
  return { row, creds, mode: (row?.mode || "TEST") as string, enabled: !!row?.enabled };
}
const isConfigured = (id: string, creds: Record<string, string>) =>
  PROVIDERS[id].fields.filter((f) => f.required).every((f) => !!creds[f.key]);

// ───────────────────────────── provider APIs ────────────────────────────────
const paypalBase = (mode: string) => (mode === "LIVE" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
async function paypalToken(c: Record<string, string>, mode: string) {
  const r = await fetch(`${paypalBase(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${c.client_id}:${c.client_secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal rejected these credentials (check Client ID/Secret and the Test/Live mode)");
  return (await r.json()).access_token as string;
}

async function stripeCall(secret: string, path: string, method = "GET", params?: Record<string, string>, idem?: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idem ? { "Idempotency-Key": idem } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  return { ok: r.ok, status: r.status, body: await r.json() };
}

async function paystackCall(secret: string, path: string, method = "GET", body?: unknown) {
  const r = await fetch(`https://api.paystack.co/${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, status: r.status, body: await r.json() };
}

async function testConnection(id: string, c: Record<string, string>, mode: string): Promise<string | null> {
  try {
    if (id === "paypal") { await paypalToken(c, mode); return null; }
    if (id === "stripe") {
      const want = mode === "LIVE" ? "_live_" : "_test_";
      if (!c.secret_key.includes(want) || !c.publishable_key.includes(want)) return `Mode is ${mode}: both keys must be ${mode.toLowerCase()} keys (contain "${want}")`;
      if (!c.publishable_key.startsWith("pk_")) return "The publishable key must start with pk_";
      const r = await stripeCall(c.secret_key, "balance");
      return r.status === 401 ? "Stripe rejected the secret key" : null;
    }
    if (id === "nexapay") return null; // NexaPay exposes no key-check endpoint: validated on the first payment
    if (id === "paystack") {
      const want = mode === "LIVE" ? "_live_" : "_test_";
      if (!c.secret_key.includes(want) || !c.public_key.includes(want)) return `Mode is ${mode}: both keys must be ${mode.toLowerCase()} keys (contain "${want}")`;
      const r = await paystackCall(c.secret_key, "bank?perPage=1");
      return r.ok ? null : "Paystack rejected the secret key";
    }
  } catch (e) { return (e as Error).message; }
  return "Unknown provider";
}

const hmacHex = async (secret: string, data: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const NEXAPAY_ORIGIN = "https://thankful-nexa-pay-flow.base44.app";
const NEXAPAY_DISPATCHER = "https://base44-dispatcher-production.base44.workers.dev";

// ───────────────────────────── orders & intents ─────────────────────────────
// deno-lint-ignore no-explicit-any
async function loadPayableOrder(db: any, orderNumber: string) {
  const fetchOrder = async () => (await db.from("orders").select("*").eq("order_number", orderNumber).maybeSingle()).data;
  let order = await fetchOrder();
  if (!order) return { error: json({ ok: false, error: "Order not found" }, 404) };
  if (order.status !== "PENDING_PAYMENT") return { error: json({ ok: false, error: "Order is not awaiting payment" }, 409) };

  // The amount charged is NEVER the one the browser sent: the order is re-priced from the
  // catalogue (prices, promotions, coupon, shipping, tax, plan) before any provider is called.
  if (!order.price_verified) {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/checkoutRevalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ verify_order: orderNumber }),
    });
    const v = await r.json().catch(() => ({}));
    if (!r.ok || !v.ok) return { error: json({ ok: false, error: v.error || "This order could not be priced. Please try again." }, 409) };
    order = await fetchOrder();
    if (!order?.price_verified) return { error: json({ ok: false, error: "This order could not be verified" }, 409) };
  }

  const total = Number(order.total);
  if (!(total > 0)) return { error: json({ ok: false, error: "Invalid order total" }, 400) };
  const down = Number(order.down_payment) || 0;
  const dueNow = Number(order.installment_count) > 0 && down > 0 ? Math.min(down, total) : total;
  return { order, total, dueNow };
}

// deno-lint-ignore no-explicit-any
async function recordIntent(db: any, p: { order_number: string; provider: string; amount: number; currency: string; external_id: string; total: number; dueNow: number; order_currency: string; converted?: boolean }) {
  await db.from("payment_intents").insert({
    order_number: p.order_number, provider: p.provider, amount: p.amount, currency: p.currency,
    status: "CREATED", external_id: p.external_id,
    payment_mode: p.dueNow < p.total ? "INSTALLMENT" : "PAY_NOW",
    down_payment: p.dueNow < p.total ? p.dueNow : null,
    metadata: { order_total: p.total, order_currency: p.order_currency, due_now: p.dueNow, converted: !!p.converted },
  });
}

// deno-lint-ignore no-explicit-any
async function finalize(db: any, intent: any, paid: number, paidCurrency: string, extra: Record<string, unknown> = {}) {
  const sameAmount = Math.abs(paid - Number(intent.amount)) < 0.005;
  const sameCurrency = String(paidCurrency).toUpperCase() === String(intent.currency).toUpperCase();
  if (!sameAmount || !sameCurrency) {
    await db.from("payment_intents").update({ status: "FAILED", failure_reason: "amount_mismatch", metadata: { ...(intent.metadata || {}), ...extra, paid, paid_currency: paidCurrency } }).eq("id", intent.id);
    return json({ ok: false, error: "Payment amount mismatch — flagged for review" }, 409);
  }
  await db.from("payment_intents").update({ status: "SUCCEEDED", confirmed_at: new Date().toISOString(), metadata: { ...(intent.metadata || {}), ...extra } }).eq("id", intent.id);
  const { data: changed } = await db.from("orders").update({ status: "PAID" }).eq("order_number", intent.order_number).eq("status", "PENDING_PAYMENT").select();
  // Stock is only consumed once the payment is confirmed (guests never touch inventory before paying).
  if (changed?.length) await commitStock(db, changed[0]);
  return json({ ok: true, order_number: intent.order_number });
}

// deno-lint-ignore no-explicit-any
async function commitStock(db: any, order: any) {
  try {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const productId = it.product_id || it.id;
      if (qty <= 0 || !productId) continue;
      const { data: p } = await db.from("products").select("id,name,veyro_stock,veyro_allocated_stock,available_to_sell").eq("id", productId).maybeSingle();
      if (!p) continue;
      const patch: Record<string, number> = {};
      if (Number(p.veyro_allocated_stock) > 0) {
        const cur = p.available_to_sell != null ? Number(p.available_to_sell) : Number(p.veyro_allocated_stock);
        patch.available_to_sell = Math.max(0, cur - qty);
      }
      if (it.fulfillment_source === "VEYRO") {
        const oldStock = Number(p.veyro_stock) || 0;
        patch.veyro_stock = Math.max(0, oldStock - qty);
        await db.from("stock_movements").insert({ product_id: p.id, product_name: p.name || it.name || "", qty: -qty, old_stock: oldStock, new_stock: patch.veyro_stock, reason: "ORDER_FULFILLMENT", order_number: order.order_number });
      }
      if (Object.keys(patch).length) await db.from("products").update(patch).eq("id", p.id);
    }
    const promoIds = Array.isArray(order.price_snapshot?.promotion_ids) ? order.price_snapshot.promotion_ids : [];
    for (const id of promoIds) {
      const { data: pr } = await db.from("promotions").select("usage_count").eq("id", id).maybeSingle();
      if (pr) await db.from("promotions").update({ usage_count: (Number(pr.usage_count) || 0) + 1 }).eq("id", id);
    }
  } catch (e) {
    console.error("commitStock failed (payment already confirmed)", e);
  }
}

// ───────────────────────────── create (public) ──────────────────────────────
// deno-lint-ignore no-explicit-any
async function create(db: any, providerId: string, orderNumber: string) {
  const def = PROVIDERS[providerId];
  if (!def) return json({ ok: false, error: "Unknown provider" }, 400);
  const prov = await loadProvider(db, providerId);
  if (!prov.enabled || !isConfigured(providerId, prov.creds)) return json({ ok: false, error: `${def.label} is not available` }, 503);
  const o = await loadPayableOrder(db, orderNumber);
  if (o.error) return o.error;
  const { order, total, dueNow } = o as { order: Record<string, string>; total: number; dueNow: number };
  const orderCurrency = String(order.currency || "USD").toUpperCase();
  const c = prov.creds;

  if (providerId === "paypal") {
    let currency = orderCurrency, amount = dueNow, converted = false;
    if (!PAYPAL_CURRENCIES.has(currency)) {
      const { data: r } = await db.from("currency_rates").select("rate").eq("code", currency).maybeSingle();
      const rate = Number(r?.rate);
      if (!(rate > 0)) return json({ ok: false, error: `PayPal does not support ${currency}` }, 400);
      amount = dueNow / rate; currency = "USD"; converted = true;
    }
    const value = PAYPAL_NO_DECIMALS.has(currency) ? String(Math.round(amount)) : (Math.round(amount * 100) / 100).toFixed(2);
    const token = await paypalToken(c, prov.mode);
    const res = await fetch(`${paypalBase(prov.mode)}/v2/checkout/orders`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: orderNumber, custom_id: orderNumber, description: `VEYRO order ${orderNumber}`, amount: { currency_code: currency, value } }],
        payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } } }),
    });
    const pp = await res.json();
    if (!res.ok || !pp.id) return json({ ok: false, error: pp.message || "PayPal order creation failed" }, 502);
    await recordIntent(db, { order_number: orderNumber, provider: "paypal", amount: Number(value), currency, external_id: pp.id, total, dueNow, order_currency: orderCurrency, converted });
    return json({ ok: true, provider: "paypal", external_id: pp.id, client_id: c.client_id, currency, amount: Number(value), converted });
  }

  if (providerId === "stripe") {
    const zero = STRIPE_ZERO_DECIMAL.has(orderCurrency);
    const minor = zero ? Math.round(dueNow) : Math.round(dueNow * 100);
    const params: Record<string, string> = {
      amount: String(minor), currency: orderCurrency.toLowerCase(),
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never", // embedded only — never leave the page
      "metadata[order_number]": orderNumber,
      description: `VEYRO order ${orderNumber}`,
    };
    if (order.customer_email) params.receipt_email = order.customer_email;
    const r = await stripeCall(c.secret_key, "payment_intents", "POST", params, `pi-${orderNumber}-${crypto.randomUUID()}`);
    if (!r.ok) return json({ ok: false, error: r.body?.error?.message || "Stripe could not start the payment" }, 502);
    await recordIntent(db, { order_number: orderNumber, provider: "stripe", amount: dueNow, currency: orderCurrency, external_id: r.body.id, total, dueNow, order_currency: orderCurrency });
    return json({ ok: true, provider: "stripe", external_id: r.body.id, client_secret: r.body.client_secret, publishable_key: c.publishable_key, currency: orderCurrency, amount: dueNow });
  }

  if (providerId === "nexapay") {
    const res = await fetch(`${NEXAPAY_ORIGIN}/functions/createCheckoutSession`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.secret_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: dueNow, currency: orderCurrency, order_id: orderNumber, webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payments` }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.checkout_url) return json({ ok: false, error: data.error || `NexaPay could not start the payment (${res.status})` }, 502);
    // The hosted page is served from the PSP's own origin (the dispatcher host rejects sessions).
    const checkoutUrl = String(data.checkout_url).startsWith(NEXAPAY_DISPATCHER) ? NEXAPAY_ORIGIN + String(data.checkout_url).slice(NEXAPAY_DISPATCHER.length) : data.checkout_url;
    const externalId = String(data.session_id || `nexa-${orderNumber}-${Date.now().toString(36)}`).slice(0, 80);
    await recordIntent(db, { order_number: orderNumber, provider: "nexapay", amount: dueNow, currency: orderCurrency, external_id: externalId, total, dueNow, order_currency: orderCurrency });
    return json({ ok: true, provider: "nexapay", external_id: externalId, checkout_url: checkoutUrl, origin: NEXAPAY_ORIGIN, currency: orderCurrency, amount: dueNow });
  }

  if (providerId === "paystack") {
    if (!PAYSTACK_CURRENCIES.has(orderCurrency)) return json({ ok: false, error: `Paystack does not support ${orderCurrency}` }, 400);
    const reference = `VEY-${orderNumber}-${Date.now().toString(36)}`.slice(0, 60);
    const r = await paystackCall(c.secret_key, "transaction/initialize", "POST", {
      email: order.customer_email, amount: Math.round(dueNow * 100), currency: orderCurrency, reference, metadata: { order_number: orderNumber },
    });
    if (!r.ok || !r.body?.status) return json({ ok: false, error: r.body?.message || "Paystack could not start the payment" }, 502);
    await recordIntent(db, { order_number: orderNumber, provider: "paystack", amount: dueNow, currency: orderCurrency, external_id: reference, total, dueNow, order_currency: orderCurrency });
    return json({ ok: true, provider: "paystack", external_id: reference, access_code: r.body.data.access_code, public_key: c.public_key, currency: orderCurrency, amount: dueNow, email: order.customer_email });
  }
  return json({ ok: false, error: "Unsupported provider" }, 400);
}

// ───────────────────────────── confirm (public) ─────────────────────────────
// deno-lint-ignore no-explicit-any
async function confirm(db: any, providerId: string, externalId: string) {
  const { data: intent } = await db.from("payment_intents").select("*").eq("external_id", externalId).eq("provider", providerId).maybeSingle();
  if (!intent) return json({ ok: false, error: "Unknown payment" }, 404);
  if (intent.status === "SUCCEEDED") return json({ ok: true, order_number: intent.order_number, already: true });
  if (!["CREATED", "PENDING", "PROCESSING"].includes(intent.status)) return json({ ok: false, error: "Payment cannot be confirmed" }, 409);
  // NexaPay only confirms through its signed webhook — the browser can just wait.
  if (providerId === "nexapay") return json({ ok: true, pending: true, order_number: intent.order_number });
  const prov = await loadProvider(db, providerId);
  if (!isConfigured(providerId, prov.creds)) return json({ ok: false, error: "Provider not configured" }, 503);
  const c = prov.creds;
  const fail = async (reason: string, msg: string, code = 402) => {
    await db.from("payment_intents").update({ status: "FAILED", failure_reason: reason }).eq("id", intent.id);
    return json({ ok: false, error: msg }, code);
  };
  const pending = async (extra: Record<string, unknown>) => {
    await db.from("payment_intents").update({ status: "PROCESSING", metadata: { ...(intent.metadata || {}), ...extra } }).eq("id", intent.id);
    return json({ ok: true, pending: true, order_number: intent.order_number });
  };

  if (providerId === "paypal") {
    const token = await paypalToken(c, prov.mode);
    const res = await fetch(`${paypalBase(prov.mode)}/v2/checkout/orders/${externalId}/capture`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `cap-${externalId}` },
    });
    const pp = await res.json();
    const cap = pp?.purchase_units?.[0]?.payments?.captures?.[0];
    if (!res.ok || !cap) return fail(pp?.message || pp?.name || "capture_failed", pp?.details?.[0]?.description || pp?.message || "Payment could not be captured");
    if (cap.status !== "COMPLETED") return pending({ capture_id: cap.id, capture_status: cap.status });
    return finalize(db, intent, Number(cap.amount?.value), cap.amount?.currency_code, { capture_id: cap.id, payer_email: pp?.payer?.email_address || null });
  }

  if (providerId === "stripe") {
    const r = await stripeCall(c.secret_key, `payment_intents/${externalId}`);
    if (!r.ok) return json({ ok: false, error: "Could not verify the payment" }, 502);
    const pi = r.body;
    if (pi.status === "succeeded") {
      const zero = STRIPE_ZERO_DECIMAL.has(String(pi.currency).toUpperCase());
      return finalize(db, intent, zero ? Number(pi.amount_received) : Number(pi.amount_received) / 100, String(pi.currency), { stripe_charge: pi.latest_charge || null });
    }
    if (pi.status === "processing") return pending({ stripe_status: pi.status });
    if (pi.status === "canceled" || pi.status === "requires_payment_method") return fail(pi.last_payment_error?.code || pi.status, pi.last_payment_error?.message || "Payment was not completed");
    return pending({ stripe_status: pi.status });
  }

  if (providerId === "paystack") {
    const r = await paystackCall(c.secret_key, `transaction/verify/${encodeURIComponent(externalId)}`);
    const d = r.body?.data;
    if (!r.ok || !d) return json({ ok: false, error: "Could not verify the payment" }, 502);
    if (d.status === "success") return finalize(db, intent, Number(d.amount) / 100, d.currency, { paystack_id: d.id, channel: d.channel });
    if (d.status === "failed" || d.status === "abandoned") return fail(d.status, d.gateway_response || "Payment was not completed");
    return pending({ paystack_status: d.status });
  }
  return json({ ok: false, error: "Unsupported provider" }, 400);
}

// ───────────────────────────── Stripe webhook ───────────────────────────────
async function verifyStripeSignature(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  const sent = String(parts.v1 || "");
  if (sent.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sent.charCodeAt(i);
  return diff === 0;
}

// deno-lint-ignore no-explicit-any
async function stripeWebhook(db: any, raw: string, sig: string) {
  const prov = await loadProvider(db, "stripe");
  if (!prov.creds.webhook_secret) return json({ error: "Webhook secret not configured" }, 400);
  if (!(await verifyStripeSignature(raw, sig, prov.creds.webhook_secret))) return json({ error: "Invalid signature" }, 400);
  const event = JSON.parse(raw);
  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    // Re-verify with Stripe instead of trusting the payload.
    await confirm(db, "stripe", event.data.object.id);
  }
  return json({ received: true });
}

// deno-lint-ignore no-explicit-any
async function nexapayWebhook(db: any, raw: string, sig: string) {
  const prov = await loadProvider(db, "nexapay");
  const secret = prov.creds.webhook_secret;
  if (!secret) return json({ error: "Webhook secret not configured" }, 400);
  const parts: Record<string, string> = {};
  for (const kv of sig.split(",")) { const i = kv.indexOf("="); if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); }
  if (!parts.t || !parts.v1 || !safeEqual(parts.v1, await hmacHex(secret, `${parts.t}.${raw}`))) return json({ error: "Invalid signature" }, 401);

  const evt = JSON.parse(raw);
  const d = evt.data || {};
  const type = String(evt.type || evt.event || "");
  const orderNumber = String(d.order_number || evt.order_number || d.order_id || evt.order_id || "");
  const amount = d.amount != null ? Number(d.amount) : evt.amount != null ? Number(evt.amount) : null;
  const currency = String(d.currency || evt.currency || "");
  const log = (status: string, error?: string) => db.from("psp_webhook_events").insert({ provider: "nexapay", event_type: type, external_id: String(evt.id || evt.transaction_id || ""), signature_valid: true, processed: status === "PROCESSED", status, order_number: orderNumber || null, amount, currency: currency || null, error: error || null });

  const { data: intents } = await db.from("payment_intents").select("*").eq("provider", "nexapay").eq("order_number", orderNumber).order("created_date", { ascending: false }).limit(1);
  const intent = intents?.[0];
  if (!intent) { await log("TRANSACTION_MISMATCH", "No intent for this order"); return json({ received: true, ignored: true }); }

  if (type === "payment.succeeded") {
    if (amount != null && Math.abs(amount - Number(intent.amount)) > 0.01) {
      await db.from("payment_intents").update({ status: "FAILED", failure_reason: "amount_mismatch" }).eq("id", intent.id);
      await log("TRANSACTION_MISMATCH", `Amount ${amount} vs intent ${intent.amount}`);
      return json({ received: true });
    }
    if (intent.status !== "SUCCEEDED") await finalize(db, intent, amount ?? Number(intent.amount), currency || intent.currency, { nexapay_event: type });
    await log("PROCESSED");
  } else if (type === "payment.failed" || type === "payment.cancelled") {
    if (intent.status !== "SUCCEEDED") await db.from("payment_intents").update({ status: type === "payment.failed" ? "FAILED" : "CANCELLED", failure_reason: String(d.reason || d.error || evt.reason || type) }).eq("id", intent.id);
    await log("PROCESSED");
  } else {
    await log("IGNORED");
  }
  return json({ received: true });
}

// ───────────────────────────── admin (vault) ────────────────────────────────
// deno-lint-ignore no-explicit-any
async function adminList(db: any) {
  const out = [];
  for (const [id, def] of Object.entries(PROVIDERS)) {
    const p = await loadProvider(db, id);
    const hints: Record<string, string> = {};
    for (const f of def.fields) if (p.creds[f.key]) hints[f.key] = f.secret ? mask(p.creds[f.key]) : p.creds[f.key];
    out.push({ id, label: def.label, region: def.region, desc: def.desc, docs: def.docs, fields: def.fields,
      configured: isConfigured(id, p.creds), enabled: p.enabled, mode: p.mode, hints });
  }
  return json({ ok: true, providers: out });
}

// deno-lint-ignore no-explicit-any
async function adminSave(db: any, admin: any, user: { email: string; id: string }, body: any) {
  const id = String(body.provider || "");
  const def = PROVIDERS[id];
  if (!def) return json({ error: "Unknown provider" }, 400);
  const mode = body.mode === "LIVE" ? "LIVE" : "TEST";
  const existing = await loadProvider(db, id);
  const creds: Record<string, string> = { ...existing.creds };
  for (const f of def.fields) {
    const v = body.credentials?.[f.key];
    if (typeof v === "string" && v.trim()) creds[f.key] = v.trim();
  }
  if (!isConfigured(id, creds)) return json({ error: `Missing: ${def.fields.filter((f) => f.required && !creds[f.key]).map((f) => f.label).join(", ")}` }, 400);
  const problem = await testConnection(id, creds, mode);
  if (problem) return json({ error: problem }, 400);

  const hints: Record<string, string> = {};
  for (const f of def.fields) if (creds[f.key]) hints[f.key] = f.secret ? mask(creds[f.key]) : creds[f.key];
  const row = { provider: id, label: def.label, mode, enabled: body.enabled !== false, configured: true, hints, credentials: { enc: await encrypt(db, creds) }, updated_by: user.email };
  if (existing.row) await db.from("psp_credentials").update(row).eq("id", existing.row.id);
  else await db.from("psp_credentials").insert(row);
  await admin.entities.AuditLog.create({ actor_email: user.email, actor_id: user.id, action: "PSP_CONNECTED", target_type: "psp", target_id: id, details: `${def.label} connected in ${mode} mode` }).catch(() => {});
  return json({ ok: true });
}

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const ctx = await createContext(req);
  const db = ctx.db;

  if (sig) return stripeWebhook(db, await req.text(), sig);
  const nexaSig = req.headers.get("nexapay-signature");
  if (nexaSig) return nexapayWebhook(db, await req.text(), nexaSig);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  // ── public ──
  if (action === "providers") {
    const out = [];
    for (const [id, def] of Object.entries(PROVIDERS)) {
      const p = await loadProvider(db, id);
      if (p.enabled && isConfigured(id, p.creds)) out.push({ id, label: def.label, region: def.region, desc: def.desc });
    }
    return json({ ok: true, providers: out });
  }
  if (action === "order_lookup") {
    // Guests look an order up with its number + the e-mail used at checkout (nothing is listed without both).
    const num = String(body.order_number || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[A-Z0-9-]{4,40}$/.test(num) || !email) return json({ ok: false, error: "Order number and e-mail are required" }, 400);
    const { data: o } = await db.from("orders").select("*").eq("order_number", num).maybeSingle();
    if (!o || String(o.customer_email || "").toLowerCase() !== email) return json({ ok: false, error: "No order matches these details" }, 404);
    const { price_snapshot: _hidden, ...safe } = o; // supplier costs / margins never leave the server
    return json({ ok: true, order: safe });
  }
  if (action === "my_orders") {
    // Signed-in customers: their orders (by account or checkout e-mail), without internal cost data.
    if (!ctx.user) return json({ ok: false, error: "Unauthorized" }, 401);
    const email = String(ctx.user.email || "").toLowerCase();
    // Two exact-match queries (an ilike on its own would treat "_" in an e-mail as a wildcard).
    const { data: byId } = await db.from("orders").select("*").eq("created_by_id", ctx.user.id).limit(100);
    const { data: byMail } = await db.from("orders").select("*").ilike("customer_email", email.replace(/[%_\\]/g, (m) => "\\" + m)).limit(100);
    const seen = new Set<string>();
    // deno-lint-ignore no-explicit-any
    const rows = [...(byId || []), ...(byMail || []).filter((o: any) => String(o.customer_email || "").toLowerCase() === email)]
      // deno-lint-ignore no-explicit-any
      .filter((o: any) => !seen.has(o.id) && seen.add(o.id))
      // deno-lint-ignore no-explicit-any
      .sort((x: any, y: any) => String(y.created_date).localeCompare(String(x.created_date)));
    // deno-lint-ignore no-explicit-any
    const orders = rows.map(({ price_snapshot: _hidden, ...safe }: any) => safe);
    return json({ ok: true, orders });
  }
  if (action === "create") {
    const orderNumber = String(body.order_number || "");
    if (!/^[A-Z0-9-]{4,40}$/.test(orderNumber)) return json({ ok: false, error: "Invalid order number" }, 400);
    return create(db, String(body.provider || ""), orderNumber);
  }
  if (action === "confirm") {
    const ext = String(body.external_id || "");
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(ext)) return json({ ok: false, error: "Invalid payment id" }, 400);
    return confirm(db, String(body.provider || ""), ext);
  }

  // ── admin only ──
  if (!ctx.user) return json({ error: "Unauthorized" }, 401);
  if (ctx.user.role !== "admin") return json({ error: "Forbidden" }, 403);
  if (action === "admin_list") return adminList(db);
  if (action === "admin_save") return adminSave(db, ctx.admin, ctx.user, body);
  if (action === "admin_toggle") {
    const id = String(body.provider || "");
    const p = await loadProvider(db, id);
    if (!PROVIDERS[id] || !p.row) return json({ error: "Provider not connected" }, 400);
    await db.from("psp_credentials").update({ enabled: !!body.enabled }).eq("id", p.row.id);
    return json({ ok: true });
  }
  if (action === "admin_test") {
    const id = String(body.provider || "");
    const p = await loadProvider(db, id);
    if (!PROVIDERS[id] || !isConfigured(id, p.creds)) return json({ error: "Provider not connected" }, 400);
    const problem = await testConnection(id, p.creds, p.mode);
    return problem ? json({ error: problem }, 400) : json({ ok: true });
  }
  if (action === "admin_disconnect") {
    const id = String(body.provider || "");
    const p = await loadProvider(db, id);
    if (p.row) await db.from("psp_credentials").update({ enabled: false, configured: false, credentials: null, hints: null }).eq("id", p.row.id);
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
});
