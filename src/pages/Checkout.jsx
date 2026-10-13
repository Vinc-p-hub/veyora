import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { usePricing } from "@/lib/PricingContext";
import { useLang } from "@/lib/i18n";
import { buildPaymentMethods } from "@/lib/paymentMethods";
import BrandLogo from "@/components/payments/BrandLogo";
import { useConnectedProvidersState } from "@/lib/useConnectedProviders";
import { formatPrice } from "@/lib/pricing";
import { api } from "@/api/client";
import { useSiteText } from "@/lib/useSiteText";
import { cn } from "@/lib/utils";
import PaymentEmbed, { EMBEDDED_PROVIDERS } from "@/components/payments/PaymentEmbed";
import { rememberGuestOrder } from "@/lib/guestOrders";
import { useAuth } from "@/lib/AuthContext";
import CouponField from "@/components/checkout/CouponField";
import { usePromotions } from "@/lib/PromotionsContext";

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const { country, currency } = useRegion();
  const { plans, buildPlan } = usePricing();
  const { t } = useLang();
  const getText = useSiteText();

  const [planId, setPlanId] = useState(params.get("plan") || "plan_5");
  const [provider, setProvider] = useState(""); // chosen payment method id ("card" | "paypal")
  // Storefront payment methods mirror the providers switched on in the back
  // office — nothing else is offered at checkout.
  const { providers: connected, status: payStatus, reload: reloadPay } = useConnectedProvidersState();
  const activeProviders = buildPaymentMethods(connected);
  const selected = activeProviders.some((m) => m.id === provider) ? provider : activeProviders[0]?.id;
  const selectedMethod = activeProviders.find((m) => m.id === selected);
  const [form, setForm] = useState({ name: "", email: "", address: "", city: "", postal: "" });
  const { user } = useAuth();

  // Account is optional: a signed-in customer simply gets the form pre-filled.
  useEffect(() => {
    if (!user) return;
    const saved = Array.isArray(user.addresses) ? user.addresses[0] : null;
    setForm((f) => ({
      ...f,
      name: f.name || user.full_name || "",
      email: f.email || user.email || "",
      address: f.address || saved?.line1 || saved?.address || "",
      city: f.city || saved?.city || "",
      postal: f.postal || saved?.postal || saved?.postal_code || "",
    }));
  }, [user]);
  const [placing, setPlacing] = useState(false);
  const [payingOrder, setPayingOrder] = useState(null); // live embedded payment step
  const [data, setData] = useState(null); // server-authoritative revalidation
  const [revalidating, setRevalidating] = useState(true);
  const [couponCode, setCouponCode] = useState(""); // validated server-side only
  const [blockedCountry, setBlockedCountry] = useState(false); // VEYRO does not sell here
  const { promoFor } = usePromotions();
  const unitOf = (i) => promoFor(i)?.price ?? (i.customer_price || 0);

  const cartKey = items.map((i) => `${i.id}:${i.qty}`).join("|");

  // All pricing is computed SERVER-SIDE: best eligible offer, margin, shipping, tax,
  // currency conversion and installment plan. The client only displays the result.
  useEffect(() => {
    if (!items.length) return;
    setRevalidating(true);
    api.functions
      .invoke("checkoutRevalidate", {
        items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
        country_code: country.code,
        plan_id: planId,
        coupon_code: couponCode,
      })
      .then((res) => {
        // Server-side market control — a blocked country is refused here.
        if (res.data?.blocked_country) {
          setBlockedCountry(true);
          return;
        }
        setBlockedCountry(false);
        setData(res.data);
      })
      .catch(() => {})
      .finally(() => setRevalidating(false));
  }, [cartKey, country.code, planId, couponCode]);

  const money = (v) => `${data?.symbol || ""}${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const totals = data?.totals || { subtotal: 0, shipping: 0, tax: 0, total: 0 };
  const plan = data?.plan;

  // While the live server check is running or has failed, the summary still
  // shows the REAL VEYRO prices (customer_price, converted to the active
  // currency) instead of "…" / zeros — the final total is always re-verified
  // server-side before the order goes through.
  const veyroSubtotal = Math.round(items.reduce((s, i) => s + unitOf(i) * i.qty, 0) * 100) / 100;
  const veyroShipping = country.shipping || 15;
  const veyroTax = Math.round(veyroSubtotal * country.taxRate * 100) / 100;
  const veyroTotal = Math.round((veyroSubtotal + veyroShipping + veyroTax) * 100) / 100;
  const show = (v) => (data ? money(v) : formatPrice(v, currency));

  if (payingOrder) {
    return (
      <div className="px-4 md:px-8 py-6 md:py-10 max-w-2xl mx-auto">
        <h1 className="font-display font-bold text-2xl md:text-3xl mb-1">Secure payment</h1>
        <p className="text-sm text-text-muted mb-6">
          Order {payingOrder.orderNumber} ·{" "}
          <span className="text-mono">
            {payingOrder.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {payingOrder.currency}
          </span>{" "}
          — your order is confirmed once the payment is verified.
        </p>
        <PaymentEmbed
          key={payingOrder.orderNumber}
          provider={payingOrder.provider}
          funding={payingOrder.funding}
          orderNumber={payingOrder.orderNumber}
          onPaid={() => navigate(`/orders?placed=${payingOrder.orderNumber}`)}
        />
      </div>
    );
  }

  if (blockedCountry) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-2xl mx-auto text-center">
        <h1 className="font-display font-bold text-2xl">We don't deliver to {country.name} yet</h1>
        <p className="text-sm text-text-muted mt-2">
          Pick another delivery country at the top of the page to continue your order.
        </p>
        <Link to="/category" className="inline-flex mt-4 px-5 py-3 rounded-full bg-noon text-noon-fg text-sm font-medium">
          Browse catalog
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-2xl mx-auto text-center">
        <h1 className="font-display font-bold text-2xl">Nothing to check out</h1>
        <Link to="/category" className="inline-flex mt-4 px-5 py-3 rounded-full bg-noon text-noon-fg text-sm font-medium">Browse catalog</Link>
      </div>
    );
  }

  const placeOrder = async () => {
    if (!form.name || !form.email || !form.address) return;
    if (!selected) return; // no payment method connected: never create an unpayable order
    setPlacing(true);
    // Final server-side gate — offer, price, supplier availability and the
    // internal VEYRO allocation are re-verified live and the allocation is
    // decremented atomically before the order is written. If the supplier is
    // unavailable, the order is refused.
    let d = data;
    const orderNumber = "VYR-" + Date.now().toString(36).toUpperCase().slice(-8);
    try {
      const res = await api.functions.invoke("checkoutRevalidate", {
        items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
        country_code: country.code,
        plan_id: planId,
        commit: false, // stock is consumed server-side once the payment is confirmed
        order_number: orderNumber,
        coupon_code: couponCode,
      });
      d = res.data;
      if (d?.blocked_country) {
        setPlacing(false);
        setBlockedCountry(true);
        return;
      }
      setData(d);
    } catch (_e) {
      // Live check unreachable — the order proceeds on the real VEYRO prices
      // already shown to the customer (VEYRO warehouse stock covers it, no
      // supplier can ever block the order).
      if (!d) {
        const conv = (v) => Math.round(v * (currency?.rate || 1) * 100) / 100;
        d = {
          currency: currency?.code || "USD",
          items: items.map((i) => ({
            product_id: i.id,
            name: i.name,
            brand: i.brand,
            qty: i.qty,
            unit_price: unitOf(i),
            line_total: Math.round(unitOf(i) * i.qty * 100) / 100,
            seller_id: i.seller_id || null,
            seller_name: i.seller_name || i.source_name,
            delivery_days: i.delivery_days || 5,
            fulfillment_source: "VEYRO",
            available: true,
          })),
          totals: { subtotal: conv(veyroSubtotal), shipping: conv(veyroShipping), tax: conv(veyroTax), total: conv(veyroTotal) },
        };
      }
    }
    const finalItems = (d.items || []).filter((i) => i.available);
    const finalTotals = d.totals || { subtotal: 0, shipping: 0, tax: 0, total: 0 };
    try {
      await api.entities.Order.create({
        order_number: orderNumber,
        customer_email: form.email,
        customer_name: form.name,
        items: finalItems.map((i) => ({
          id: i.product_id,
          name: i.name,
          brand: i.brand,
          price: i.unit_price,
          qty: i.qty,
          seller_id: i.seller_id,
          seller_name: i.seller_name,
          delivery_days: i.delivery_days,
          fulfillment_source: i.fulfillment_source || "SUPPLIER",
        })),
        subtotal: finalTotals.subtotal,
        discount: finalTotals.discount || 0,
        coupon_code: d.coupon?.valid ? d.coupon.code : "",
        shipping: finalTotals.shipping,
        tax: finalTotals.tax,
        total: finalTotals.total,
        currency: d.currency,
        country: country.code,
        payment_provider: selectedMethod?.provider,
        down_payment: d.plan?.downPayment || finalTotals.total,
        installment_count: d.plan?.installmentCount || 0,
        installment_amount: d.plan?.installmentAmount || 0,
        price_snapshot: d.snapshot, // immutable — future price changes never touch this order
        // No payment is captured on the client's word — the order stays pending
        // until the provider's signed webhook confirms it server-side.
        status: "PENDING_PAYMENT",
        address: { line: form.address, city: form.city, postal: form.postal },
        tracking_number: "TRK" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      });
      rememberGuestOrder(orderNumber, form.email);
      clearCart();
      if (selectedMethod && EMBEDDED_PROVIDERS.includes(selectedMethod.provider)) {
        // Embedded payment (no redirect): PAID only after the server verifies the payment with the provider.
        setPlacing(false);
        setPayingOrder({ orderNumber, currency: d.currency, total: finalTotals.total, provider: selectedMethod.provider, funding: selectedMethod.funding });
      } else {
        navigate(`/orders?placed=${orderNumber}`);
      }
    } catch (e) {
      setPlacing(false);
      alert("Order failed. Please try again.");
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display font-bold text-2xl md:text-3xl">Checkout</h1>
        {revalidating && <span className="text-xs text-text-muted animate-pulse">Re-checking live prices…</span>}
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h2 className="font-display font-semibold text-lg mb-1">Delivery to {country.flag} {country.name}</h2>
            <p className="text-xs text-text-muted mb-4">
              {user ? (
                <>Signed in as {user.email}.</>
              ) : (
                <>No account needed — check out as a guest. Already a customer?{" "}
                  <Link to={"/login?returnTo=" + encodeURIComponent("/checkout")} className="underline font-medium">Sign in</Link> (optional).</>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-2 bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
              <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="col-span-2 bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
              <input placeholder="Address line" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="col-span-2 bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
              <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
              <input placeholder="Postal code" value={form.postal} onChange={(e) => setForm({ ...form, postal: e.target.value })} className="bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
            </div>
          </section>

          <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h2 className="font-display font-semibold text-lg mb-4">Payment plan</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {plans.map((opt) => {
                const p = buildPlan(data ? totals.total : veyroTotal, opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPlanId(opt.id)}
                    className={cn(
                      "p-3.5 rounded-lg border text-left transition",
                      planId === opt.id ? "border-accent-cyan bg-accent-cyan/5" : "border-border-hairline hover:border-accent-cyan/30"
                    )}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-mono text-xs text-accent-cyan mt-1">
                      {p.count === 0 ? show(p.total) : `${show(p.first_payment)} today · ${t("card.paymentsTotal", { n: p.count, total: show(p.total) })}`}
                    </div>
                  </button>
                );
              })}
            </div>
            {plan && plan.count > 0 && (
              <div className="mt-3 rounded-lg bg-surface-primary p-3.5 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-text-muted">{t("detail.payToday", { p: money(plan.first_payment ?? plan.downPayment) })}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">{t("detail.thenPayments", { n: plan.count ?? plan.installmentCount, p: money(plan.next_amount ?? plan.installmentAmount) })}</span><span className="text-mono">{money(plan.next_amount ?? plan.installmentAmount)}</span></div>
                <div className="flex justify-between border-t border-border-hairline pt-1.5 font-semibold"><span>{t("detail.total", { p: money(plan.total ?? plan.totalPaid) })}</span><span className="text-mono">{money(plan.total ?? plan.totalPaid)}</span></div>
              </div>
            )}
          </section>

          <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h2 className="font-display font-semibold text-lg mb-1">Payment method</h2>
            <p className="text-xs text-text-muted mb-4">Secure payment — you stay on this page.</p>
            <div className="space-y-2.5">
              {activeProviders.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setProvider(m.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition text-start",
                    selected === m.id ? "border-accent-cyan bg-accent-cyan/5" : "border-border-hairline hover:border-accent-cyan/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", selected === m.id ? "border-accent-cyan" : "border-border-hairline")}>
                      {selected === m.id && <div className="w-2.5 h-2.5 rounded-full bg-accent-cyan" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-xs text-text-muted">{m.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {m.logos.map((l) => <BrandLogo key={l} id={l} height={l === "paypal" ? 18 : 20} />)}
                  </div>
                </button>
              ))}
              {activeProviders.length === 0 && (
                payStatus === "loading" ? (
                  <p className="text-sm text-text-muted animate-pulse">Loading payment methods…</p>
                ) : payStatus === "error" ? (
                  <p className="text-sm p-3 rounded-2xl bg-amber-50 text-amber-800">
                    We couldn't load the payment methods.{" "}
                    <button onClick={reloadPay} className="underline font-medium">Try again</button>
                  </p>
                ) : (
                  <p className="text-sm p-3 rounded-2xl bg-amber-50 text-amber-800">
                    Payments are temporarily unavailable, so orders cannot be placed right now. Please try again shortly.
                  </p>
                )
              )}
            </div>
          </section>
        </div>

        <div className="md:col-span-1">
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5 sticky top-24">
            <h2 className="font-display font-semibold text-lg mb-4">Summary</h2>
            {!data && (
              <p className="text-[11px] text-text-muted bg-surface-primary rounded-lg p-2.5 mb-3">
                Live server check pending — the amounts shown are the real VEYRO prices for your items. The final total is re-verified before the order is placed.
              </p>
            )}
            <div className="space-y-2.5 text-sm max-h-40 overflow-auto scrollbar-hide mb-3">
              {(data?.items || items.map((i) => ({ product_id: i.id, name: i.name, qty: i.qty, available: true, line_total: unitOf(i) * i.qty, veyro_price: true }))).map((i) => (
                <div key={i.product_id} className="flex justify-between gap-2">
                  <span className="text-text-muted">
                    <span className="block truncate">{i.name} ×{i.qty}{i.available === false && <span className="text-red-500"> · unavailable</span>}</span>
                    {i.available !== false && (i.seller_name || i.delivery_days) && (
                      <span className="block text-[10px] text-text-muted/80 truncate">
                        {i.seller_name ? `Sold by ${i.seller_name}` : ""}{i.seller_name && i.delivery_days ? " · " : ""}{i.delivery_days ? `${i.delivery_days}-day delivery` : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-mono shrink-0">{i.line_total !== undefined ? (i.veyro_price ? formatPrice(i.line_total, currency) : money(i.line_total)) : "…"}</span>
                </div>
              ))}
            </div>
            <div className="mb-3">
              <CouponField
                applied={couponCode}
                result={data?.coupon}
                loading={revalidating}
                onApply={setCouponCode}
                onRemove={() => setCouponCode("")}
              />
            </div>
            <div className="border-t border-border-hairline pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span className="text-mono">{data ? money(totals.subtotal) : formatPrice(veyroSubtotal, currency)}</span></div>
              {data && totals.discount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Promo code</span><span className="text-mono">−{money(totals.discount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-text-muted">Shipping</span><span className="text-mono">{data ? (data.free_shipping ? "Free" : money(totals.shipping)) : formatPrice(veyroShipping, currency)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Tax ({(country.taxRate * 100).toFixed(0)}%)</span><span className="text-mono">{data ? money(totals.tax) : formatPrice(veyroTax, currency)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border-hairline pt-2"><span>Total</span><span className="text-mono">{data ? money(totals.total) : formatPrice(veyroTotal, currency)}</span></div>
              {data && totals.savings > 0 && (
                <div className="flex justify-between text-xs text-emerald-600"><span>You save</span><span className="text-mono">{money(totals.savings)}</span></div>
              )}
              {plan && plan.installmentCount > 0 && (
                <div className="flex justify-between text-accent-cyan"><span>Pay today</span><span className="text-mono">{money(plan.downPayment)}</span></div>
              )}
            </div>
            <button
              onClick={placeOrder}
              disabled={placing || revalidating || !selected || items.length === 0 || !form.name || !form.email || !form.address}
              className="w-full mt-5 py-3.5 rounded-full bg-noon text-noon-fg font-semibold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {placing ? "Processing…" : <><Lock className="w-4 h-4" /> Place order · {data ? money(plan && plan.installmentCount > 0 ? plan.downPayment : totals.total) : formatPrice(veyroTotal, currency)}</>}
            </button>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5" /> Prices verified server-side at checkout
            </div>
            <p className="mt-3 rounded-lg bg-surface-primary p-2.5 text-[11px] text-text-muted leading-snug text-center">
              {getText("marketplace_notice", "VEYRO Marketplace — you are buying via VEYRO from an identified partner seller.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}