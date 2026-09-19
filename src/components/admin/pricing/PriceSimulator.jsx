import React, { useEffect, useState } from "react";
import { PlayCircle, Calculator } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { listCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
];

// PRICE SIMULATOR — supplier price → margin → fees → customer price →
// first installment → next installments → total cost → VEYRO margin.
// All computed server-side by the pricing engine with the ACTIVE rules.
export default function PriceSimulator({ planOptions, defaultPlanId }) {
  const [sources, setSources] = useState([]);
  const [input, setInput] = useState({ supplier_price: 100, category: "Laptops", country_code: "US", source_id: "", plan_id: defaultPlanId || "plan_5" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.CrawlerSource.list(null, 100).then(setSources).catch(() => {});
  }, []);

  useEffect(() => {
    if (defaultPlanId) setInput((s) => ({ ...s, plan_id: s.plan_id || defaultPlanId }));
  }, [defaultPlanId]);

  const simulate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("pricingEngine", { mode: "simulate", ...input, source_id: input.source_id || null });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Simulation failed");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { simulate(); /* initial view */ }, []);

  const usd = (v) => `$${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const chain = result?.chain;
  const plan = result?.plan;

  const inputCls = "bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50 w-full";

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <h3 className="font-display font-semibold flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-accent-cyan" /> Price simulator
      </h3>
      <p className="text-xs text-text-muted mb-4">
        Enter a supplier price — the server pricing engine applies the active rules: margin → fees → customer price → installments.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="text-[10px] uppercase text-text-muted">Supplier price (USD)</label>
          <input type="number" min="0" step="0.01" value={input.supplier_price}
            onChange={(e) => setInput({ ...input, supplier_price: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-muted">Category rule</label>
          <select value={input.category} onChange={(e) => setInput({ ...input, category: e.target.value })} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-muted">Country rule</label>
          <select value={input.country_code} onChange={(e) => setInput({ ...input, country_code: e.target.value })} className={inputCls}>
            {listCountries().map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-muted">Supplier rule</label>
          <select value={input.source_id} onChange={(e) => setInput({ ...input, source_id: e.target.value })} className={inputCls}>
            <option value="">None</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-text-muted">Plan</label>
          <select value={input.plan_id} onChange={(e) => setInput({ ...input, plan_id: e.target.value })} className={inputCls}>
            {(planOptions || []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <button onClick={simulate} disabled={busy}
        className="mt-4 px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
        <PlayCircle className="w-4 h-4" /> {busy ? "Simulating…" : "Simulate"}
      </button>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      {chain && plan && (
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-primary p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Price chain (USD)</div>
            <div className="flex justify-between"><span className="text-text-muted">Supplier price</span><span className="text-mono">{usd(chain.supplier_price)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">VEYRO margin ({chain.margin_percent}%)</span><span className="text-mono">+{usd(chain.margin_amount)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Payment fee</span><span className="text-mono">+{usd(chain.payment_fee)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Financing fee</span><span className="text-mono">+{usd(chain.financing_fee)}</span></div>
            <div className="flex justify-between border-t border-border-hairline pt-2 font-semibold"><span>Customer price</span><span className="text-mono text-accent-cyan">{usd(chain.customer_price)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Partner commission</span><span className="text-mono">−{usd(chain.partner_commission)}</span></div>
            <div className="flex justify-between font-semibold"><span>VEYRO net margin</span><span className="text-mono text-emerald-600">{usd(chain.veyro_margin)}</span></div>
          </div>
          <div className="rounded-lg bg-surface-primary p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Installments ({plan.label})</div>
            {plan.count > 0 ? (
              <>
                <div className="flex justify-between"><span className="text-text-muted">First payment today</span><span className="text-mono text-accent-cyan font-semibold">{usd(plan.first_payment)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Then {plan.count} × monthly</span><span className="text-mono">{usd(plan.next_amount)}</span></div>
                <div className="flex justify-between border-t border-border-hairline pt-2 font-semibold"><span>Total cost</span><span className="text-mono">{usd(plan.total)}</span></div>
              </>
            ) : (
              <div className="flex justify-between font-semibold"><span>Pay in full</span><span className="text-mono">{usd(plan.total)}</span></div>
            )}
            {result?.local && (
              <div className="text-[11px] text-text-muted pt-2 border-t border-border-hairline">
                In {result.local.currency}: customer price {result.local.symbol}{result.local.customer_price.toLocaleString()} · first {result.local.symbol}{result.local.first_payment.toLocaleString()} · total {result.local.symbol}{result.local.total.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}