import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { usePricing } from "@/lib/PricingContext";
import { useLang } from "@/lib/i18n";
import { PAYMENT_PROVIDERS } from "@/lib/countries";
import { base44 } from "@/api/base44Client";
import { useSiteText } from "@/lib/useSiteText";
import { cn } from "@/lib/utils";

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const { country } = useRegion();
  const { plans, buildPlan } = usePricing();
  const { t } = useLang();
  const getText = useSiteText();

  const [planId, setPlanId] = useState(params.get("plan") || "plan_5");
  const [provider, setProvider] = useState(country.providers[0]);
  const [form, setForm] = useState({ name: "", email: "", address: "", city: "", postal: "" });
  const [placing, setPlacing] = useState(false);
  const [data, setData] = useState(null); // server-authoritative revalidation
  const [revalidating, setRevalidating] = useState(true);
  const [revalError, setRevalError] = useState(null);

  const cartKey = items.map((i) => `${i.id}:${i.qty}`).join("|");

  // All pricing is computed SERVER-SIDE: best eligible offer, margin, shipping, tax,
  // currency conversion and installment plan. The client only displays the result.
  useEffect(() => {
    if (!items.length) return;
    setRevalidating(true);
    base44.functions
      .invoke("checkoutRevalidate", {
        items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
        country_code: country.code,
        plan_id: planId,
      })
      .then((res) => {
        setData(res.data);
        setRevalError(null);
      })
      .catch(() => setRevalError("We couldn't verify live prices. Please try again in a moment."))
      .finally(() => setRevalidating(false));
  }, [cartKey, country.code, planId]);

  const money = (v) => `${data?.symbol || ""}${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const totals = data?.totals || { subtotal: 0, shipping: 0, tax: 0, total: 0 };
  const plan = data?.plan;
  const warnings = data?.warnings || [];
  const orderItems = (data?.items || []).filter((i) => i.available);

  if (items.length === 0) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-2xl mx-auto text-center">
        <h1 className="font-display font-bold text-2xl">Nothing to check out</h1>
        <Link to="/category" className="inline-flex mt-4 px-5 py-3 rounded-lg bg-noon text-noon-fg text-sm font-medium">Browse catalog</Link>
      </div>
    );
  }

  const placeOrder = async () => {
    if (!form.name || !form.email || !form.address || !data) return;
    setPlacing(true);
    const orderNumber = "VYR-" + Date.now().toString(36).toUpperCase().slice(-8);
    try {
      await base44.entities.Order.create({
        order_number: orderNumber,
        customer_email: form.email,
        customer_name: form.name,
        items: orderItems.map((i) => ({
          id: i.product_id,
          name: i.name,
          brand: i.brand,
          price: i.unit_price,
          qty: i.qty,
          seller_id: i.seller_id,
          seller_name: i.seller_name,
          delivery_days: i.delivery_days,
        })),
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
        currency: data.currency,
        country: country.code,
        payment_provider: provider,
        down_payment: plan?.downPayment || totals.total,
        installment_count: plan?.installmentCount || 0,
        installment_amount: plan?.installmentAmount || 0,
        price_snapshot: data.snapshot, // immutable — future price changes never touch this order
        status: "PAID",
        address: { line: form.address, city: form.city, postal: form.postal },
        tracking_number: "TRK" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      });
      clearCart();
      navigate(`/orders?placed=${orderNumber}`);
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
          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <div className="flex items-center gap-2 font-semibold text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4" /> Some details changed since you added these items
              </div>
              <ul className="mt-2 space-y-1 text-xs text-amber-800 list-disc list-inside">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {revalError && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-sm text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {revalError}
            </div>
          )}

          <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h2 className="font-display font-semibold text-lg mb-4">Delivery to {country.flag} {country.name}</h2>
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
                const p = data ? buildPlan(totals.total, opt.id) : null;
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
                      {p ? (p.count === 0 ? money(p.total) : `${money(p.first_payment)} today · ${t("card.paymentsTotal", { n: p.count, total: money(p.total) })}`) : "…"}
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
            <p className="text-xs text-text-muted mb-4">Available providers for {country.name}</p>
            <div className="space-y-2.5">
              {country.providers.map((pid) => {
                const p = PAYMENT_PROVIDERS[pid];
                return (
                  <button
                    key={pid}
                    onClick={() => setProvider(pid)}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 rounded-lg border transition",
                      provider === pid ? "border-accent-cyan bg-accent-cyan/5" : "border-border-hairline hover:border-accent-cyan/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", provider === pid ? "border-accent-cyan" : "border-border-hairline")}>
                        {provider === pid && <div className="w-2.5 h-2.5 rounded-full bg-accent-cyan" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-text-muted">{p.desc}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-mono text-text-muted px-2 py-1 rounded-md border border-border-hairline">{p.badge}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="md:col-span-1">
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5 sticky top-24">
            <h2 className="font-display font-semibold text-lg mb-4">Summary</h2>
            <div className="space-y-2.5 text-sm max-h-40 overflow-auto scrollbar-hide mb-3">
              {(data?.items || items.map((i) => ({ product_id: i.id, name: i.name, qty: i.qty, available: true }))).map((i) => (
                <div key={i.product_id} className="flex justify-between gap-2">
                  <span className="text-text-muted">
                    <span className="block truncate">{i.name} ×{i.qty}{i.available === false && <span className="text-red-500"> · unavailable</span>}</span>
                    {i.available !== false && (i.seller_name || i.delivery_days) && (
                      <span className="block text-[10px] text-text-muted/80 truncate">
                        {i.seller_name ? `Sold by ${i.seller_name}` : ""}{i.seller_name && i.delivery_days ? " · " : ""}{i.delivery_days ? `${i.delivery_days}-day delivery` : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-mono shrink-0">{i.line_total !== undefined ? money(i.line_total) : "…"}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border-hairline pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span className="text-mono">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Shipping</span><span className="text-mono">{money(totals.shipping)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Tax ({(country.taxRate * 100).toFixed(0)}%)</span><span className="text-mono">{money(totals.tax)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border-hairline pt-2"><span>Total</span><span className="text-mono">{money(totals.total)}</span></div>
              {plan && plan.installmentCount > 0 && (
                <div className="flex justify-between text-accent-cyan"><span>Pay today</span><span className="text-mono">{money(plan.downPayment)}</span></div>
              )}
            </div>
            <button
              onClick={placeOrder}
              disabled={placing || revalidating || !!revalError || !data || orderItems.length === 0 || !form.name || !form.email || !form.address}
              className="w-full mt-5 py-3.5 rounded-lg bg-noon text-noon-fg font-semibold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {placing ? "Processing…" : <><Lock className="w-4 h-4" /> Place order · {money(plan && plan.installmentCount > 0 ? plan.downPayment : totals.total)}</>}
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