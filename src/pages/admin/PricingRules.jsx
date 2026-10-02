import React, { useEffect, useState } from "react";
import { Save, Plus, Trash2, Settings2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import PriceSimulator from "@/components/admin/pricing/PriceSimulator";
import PricingHistory from "@/components/admin/pricing/PricingHistory";

const CATEGORIES = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
];

const DEFAULT_CONFIG = {
  margin_percent: 30,
  payment_fee_percent: 0,
  financing_fee_percent: 0,
  shipping_fee_default: 0,
  partner_commission_percent: 10,
  first_installment_percent: 15,
  default_plan_id: "plan_5",
  rounding: "cent",
  installment_plans: [],
  category_rules: {},
  country_rules: {},
  supplier_rules: {},
};

// PRICING & BUSINESS RULES — the central module for every financial calculation
// in VEYRO. All parameters are data (PricingConfig): no code change is needed to
// adjust margins, fees, installments, rounding or per-category/country/supplier
// rules. All changes are historized; new rules apply to new calculations only —
// paid orders keep their immutable price snapshot.
export default function PricingRules() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [history, setHistory] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.functions.invoke("pricingEngine", { mode: "get" }),
      base44.entities.CrawlerSource.list(null, 100).catch(() => []),
    ])
      .then(([res, srcs]) => {
        setConfig({ ...DEFAULT_CONFIG, ...res.data.config });
        setHistory(res.data.history || []);
        setSources(srcs);
      })
      .catch(() => setMsg("Could not load pricing configuration."))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke("pricingEngine", { mode: "update", config });
      setMsg(`Saved — ${res.data.changed} parameter(s) updated and logged to the change history.`);
      const refreshed = await base44.functions.invoke("pricingEngine", { mode: "get" });
      setHistory(refreshed.data.history || []);
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const num = (key) => ({
    type: "number", step: "0.1", min: "0", max: "100",
    value: config[key],
    onChange: (e) => setConfig({ ...config, [key]: Number(e.target.value) }),
  });
  const inputCls = "bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-accent-cyan/50";

  // --- rules editors (category / country / supplier) ---
  const RulesEditor = ({ title, rulesKey, keyOptions, extraFields }) => {
    const entries = Object.entries(config[rulesKey] || {});
    const [newKey, setNewKey] = useState(keyOptions ? keyOptions[0] : "");
    return (
      <div className="rounded-lg border border-border-hairline p-4">
        <div className="text-xs font-semibold mb-2">{title}</div>
        {entries.length === 0 && <p className="text-xs text-text-muted mb-2">No override — global rules apply.</p>}
        <div className="space-y-1.5 mb-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate font-medium">{keyOptions ? (keyOptions.find((o) => o.value === k)?.label || k) : k}</span>
              <input type="number" step="0.1" className="w-20 bg-surface-primary border border-border-hairline rounded px-2 py-1 text-mono"
                value={v.margin_percent ?? ""} placeholder="margin %"
                onChange={(e) => setConfig({
                  ...config,
                  [rulesKey]: { ...config[rulesKey], [k]: { ...v, margin_percent: Number(e.target.value) } },
                })} />
              {extraFields?.includes("shipping_fee") && (
                <input type="number" step="0.1" className="w-20 bg-surface-primary border border-border-hairline rounded px-2 py-1 text-mono"
                  value={v.shipping_fee ?? ""} placeholder="ship $"
                  onChange={(e) => setConfig({
                    ...config,
                    [rulesKey]: { ...config[rulesKey], [k]: { ...v, shipping_fee: Number(e.target.value) } },
                  })} />
              )}
              {extraFields?.includes("tax_rate") && (
                <input type="number" step="0.01" className="w-20 bg-surface-primary border border-border-hairline rounded px-2 py-1 text-mono"
                  value={v.tax_rate ?? ""} placeholder="tax"
                  onChange={(e) => setConfig({
                    ...config,
                    [rulesKey]: { ...config[rulesKey], [k]: { ...v, tax_rate: Number(e.target.value) } },
                  })} />
              )}
              <button
                onClick={() => {
                  const next = { ...config[rulesKey] };
                  delete next[k];
                  setConfig({ ...config, [rulesKey]: next });
                }}
                className="ms-auto p-1 rounded hover:bg-red-50 text-red-600"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {keyOptions ? (
            <select value={newKey} onChange={(e) => setNewKey(e.target.value)} className="text-xs bg-surface-primary border border-border-hairline rounded px-2 py-1.5">
              {keyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Key"
              className="text-xs bg-surface-primary border border-border-hairline rounded px-2 py-1.5 w-32" />
          )}
          <button
            onClick={() => {
              if (!newKey) return;
              setConfig({ ...config, [rulesKey]: { ...config[rulesKey], [newKey]: { margin_percent: config.margin_percent } } });
            }}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border-hairline hover:border-accent-cyan/40 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
    );
  };

  const plans = config.installment_plans || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-accent-cyan" /> Pricing & Business Rules
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Every financial calculation derives from this config, computed server-side. The frontend can never modify prices.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="px-5 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save rules"}
        </button>
      </div>
      {msg && <div className={cn("rounded-lg p-3 text-sm", msg.includes("Saved") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>{msg}</div>}

      {loading ? (
        <div className="h-40 rounded-lg animate-pulse bg-surface-card" />
      ) : (
        <>
          {/* Global parameters */}
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h3 className="font-display font-semibold mb-4">Global parameters</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] uppercase text-text-muted">VEYRO margin (%)</label>
                <input className={inputCls} {...num("margin_percent")} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">Payment fee (%)</label>
                <input className={inputCls} {...num("payment_fee_percent")} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">Financing fee (%)</label>
                <input className={inputCls} {...num("financing_fee_percent")} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">Default shipping fee ($)</label>
                <input className={inputCls} {...num("shipping_fee_default")} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">Partner commission (%)</label>
                <input className={inputCls} {...num("partner_commission_percent")} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">First installment (%)</label>
                <input className={inputCls} {...num("first_installment_percent")} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">Default plan</label>
                <select className={inputCls} value={config.default_plan_id}
                  onChange={(e) => setConfig({ ...config, default_plan_id: e.target.value })}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted">Rounding rule</label>
                <select className={inputCls} value={config.rounding}
                  onChange={(e) => setConfig({ ...config, rounding: e.target.value })}>
                  <option value="cent">Nearest cent</option>
                  <option value="integer">Whole number</option>
                  <option value="ten">Nearest 10</option>
                </select>
              </div>
            </div>
          </div>

          {/* Installment plans editor */}
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h3 className="font-display font-semibold mb-4">Installment plans</h3>
            <div className="space-y-2">
              {plans.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <input className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 w-28 text-mono text-xs"
                    value={p.id} onChange={(e) => {
                      const next = [...plans]; next[i] = { ...p, id: e.target.value };
                      setConfig({ ...config, installment_plans: next });
                    }} placeholder="id" />
                  <input className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 flex-1 min-w-[120px] text-xs"
                    value={p.label} onChange={(e) => {
                      const next = [...plans]; next[i] = { ...p, label: e.target.value };
                      setConfig({ ...config, installment_plans: next });
                    }} placeholder="Label" />
                  <input type="number" min="0" max="24" className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 w-20 text-mono text-xs"
                    value={p.installments} onChange={(e) => {
                      const next = [...plans]; next[i] = { ...p, installments: Math.max(0, Math.min(24, Number(e.target.value) || 0)) };
                      setConfig({ ...config, installment_plans: next });
                    }} title="Number of installments" />
                  <input type="number" min="0" max="100" step="0.1" className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 w-20 text-mono text-xs"
                    value={p.down_percent} onChange={(e) => {
                      const next = [...plans]; next[i] = { ...p, down_percent: Number(e.target.value) };
                      setConfig({ ...config, installment_plans: next });
                    }} title="First installment %" />
                  <span className="text-[10px] text-text-muted w-40">installments · first %</span>
                  <button
                    onClick={() => setConfig({ ...config, installment_plans: plans.filter((_, j) => j !== i) })}
                    className="ms-auto p-1.5 rounded hover:bg-red-50 text-red-600"
                    title="Remove plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setConfig({
                ...config,
                installment_plans: [...plans, { id: `plan_${plans.length + 2}`, label: "New plan", installments: 3, down_percent: config.first_installment_percent }],
              })}
              className="mt-3 text-xs px-3 py-2 rounded-md border border-border-hairline hover:border-accent-cyan/40 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add plan
            </button>
          </div>

          {/* Per-category / per-country / per-supplier rules */}
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <h3 className="font-display font-semibold mb-4">Price rules — category, country & supplier overrides</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <RulesEditor title="By category (margin %)" rulesKey="category_rules"
                keyOptions={CATEGORIES.map((c) => ({ value: c, label: c }))} />
              <RulesEditor title="By country (margin %, shipping, tax)" rulesKey="country_rules"
                extraFields={["shipping_fee", "tax_rate"]} />
              <RulesEditor title="By supplier (margin %)" rulesKey="supplier_rules"
                keyOptions={sources.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
          </div>

          <PriceSimulator planOptions={plans} defaultPlanId={config.default_plan_id} />
          <PricingHistory history={history} />
        </>
      )}
    </div>
  );
}