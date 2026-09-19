import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice, PLAN_OPTIONS, getPlanForOption, convertPrice } from "@/lib/pricing";
import { PAYMENT_PROVIDERS } from "@/lib/countries";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const { currency, country } = useRegion();

  const [planId, setPlanId] = useState(params.get("plan") || "plan_5");
  const [provider, setProvider] = useState(country.providers[0]);
  const [form, setForm] = useState({ name: "", email: "", address: "", city: "", postal: "" });
  const [placing, setPlacing] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.customer_price * i.qty, 0);
  const shipping = country.shipping;
  const tax = Math.round(subtotal * country.taxRate * 100) / 100;
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;
  const plan = getPlanForOption(total, planId);

  if (items.length === 0) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-2xl mx-auto text-center">
        <h1 className="font-display font-bold text-2xl">Nothing to check out</h1>
        <Link to="/category" className="inline-flex mt-4 px-5 py-3 rounded-lg bg-noon text-noon-fg text-sm font-medium">Browse catalog</Link>
      </div>
    );
  }

  const placeOrder = async () => {
    if (!form.name || !form.email || !form.address) return;
    setPlacing(true);
    const orderNumber = "VYR-" + Date.now().toString(36).toUpperCase().slice(-8);
    try {
      await base44.entities.Order.create({
        order_number: orderNumber,
        customer_email: form.email,
        customer_name: form.name,
        items: items.map((i) => ({ id: i.id, name: i.name, brand: i.brand, price: i.customer_price, qty: i.qty })),
        subtotal,
        shipping,
        tax,
        total,
        currency: country.currency,
        country: country.code,
        payment_provider: provider,
        down_payment: plan.downPayment,
        installment_count: plan.installmentCount,
        installment_amount: plan.installmentAmount,
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
      <h1 className="font-display font-bold text-2xl md:text-3xl mb-6">Checkout</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Address */}
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

          {/* Payment plan */}
          <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h2 className="font-display font-semibold text-lg mb-4">Payment plan</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {PLAN_OPTIONS.map((opt) => {
                const p = getPlanForOption(total, opt.id);
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
                      {p.installmentCount === 0 ? formatPrice(p.totalPaid, currency) : `${formatPrice(p.downPayment, currency)} today`}
                    </div>
                  </button>
                );
              })}
            </div>
            {plan.installmentCount > 0 && (
              <div className="mt-3 rounded-lg bg-surface-primary p-3.5 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-text-muted">Today</span><span className="text-mono text-accent-cyan font-semibold">{formatPrice(plan.downPayment, currency)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">{plan.installmentCount} × monthly</span><span className="text-mono">{formatPrice(plan.installmentAmount, currency)}</span></div>
                <div className="flex justify-between border-t border-border-hairline pt-1.5 font-semibold"><span>Total</span><span className="text-mono">{formatPrice(plan.totalPaid, currency)}</span></div>
              </div>
            )}
          </section>

          {/* Payment provider */}
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

        {/* Summary */}
        <div className="md:col-span-1">
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5 sticky top-24">
            <h2 className="font-display font-semibold text-lg mb-4">Summary</h2>
            <div className="space-y-2.5 text-sm max-h-40 overflow-auto scrollbar-hide mb-3">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="text-text-muted truncate">{i.name} ×{i.qty}</span>
                  <span className="text-mono shrink-0">{formatPrice(i.customer_price * i.qty, currency)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border-hairline pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span className="text-mono">{formatPrice(subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Shipping</span><span className="text-mono">{formatPrice(shipping, currency)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Tax ({(country.taxRate * 100).toFixed(0)}%)</span><span className="text-mono">{formatPrice(tax, currency)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border-hairline pt-2"><span>Total</span><span className="text-mono">{formatPrice(total, currency)}</span></div>
              {plan.installmentCount > 0 && (
                <div className="flex justify-between text-accent-cyan"><span>Today's payment</span><span className="text-mono">{formatPrice(plan.downPayment, currency)}</span></div>
              )}
            </div>
            <button
              onClick={placeOrder}
              disabled={placing || !form.name || !form.email || !form.address}
              className="w-full mt-5 py-3.5 rounded-lg bg-noon text-noon-fg font-semibold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {placing ? "Processing…" : <><Lock className="w-4 h-4" /> Place order · {formatPrice(plan.installmentCount === 0 ? total : plan.downPayment, currency)}</>}
            </button>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure encrypted checkout
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}