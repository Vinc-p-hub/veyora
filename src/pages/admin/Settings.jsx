import React, { useCallback, useEffect, useState } from "react";
import { Globe, Plus, Trash2, Pencil, Wallet, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { PAYMENT_PROVIDERS, listCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

const EMPTY = { code: "", name: "", currency: "", flag: "", shipping: "", tax_rate: "", providers: [] };

// Country configuration — delivery country drives currency, availability,
// providers, shipping, taxes/duties and financing options. Every market ships
// in the code registry (~185 countries) and any of them can be overridden
// here as data (CountryConfig records): providers, shipping, taxes, currency.
export default function Settings() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await base44.entities.CountryConfig.list("code", 300));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleProvider = (p) => {
    setDraft((d) => ({
      ...d,
      providers: d.providers.includes(p) ? d.providers.filter((x) => x !== p) : [...d.providers, p],
    }));
  };

  const save = async () => {
    const code = draft.code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !draft.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        code,
        name: draft.name.trim(),
        currency: (draft.currency || "USD").toUpperCase().slice(0, 3),
        flag: draft.flag || listCountries().find((c) => c.code === code)?.flag || "🌍",
        shipping: parseFloat(draft.shipping) || 0,
        tax_rate: parseFloat(draft.tax_rate) || 0,
        providers: draft.providers.length ? draft.providers : ["stripe", "crypto"],
        enabled: true,
      };
      const existing = configs.find((c) => c.code === code);
      if (existing) await base44.entities.CountryConfig.update(existing.id, payload);
      else await base44.entities.CountryConfig.create(payload);
      setDraft(EMPTY);
      toast({ description: `Country ${code} saved — live in the region selector.` });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (c) => {
    await base44.entities.CountryConfig.update(c.id, { enabled: !c.enabled });
    load();
  };
  const remove = async (c) => {
    await base44.entities.CountryConfig.delete(c.id);
    load();
  };

  const startEdit = (c) => {
    setDraft({
      code: c.code,
      name: c.name,
      currency: c.currency,
      flag: c.flag || "",
      shipping: String(c.shipping ?? ""),
      tax_rate: String(c.tax_rate ?? ""),
      providers: c.providers || [],
    });
  };
  const cancelEdit = () => setDraft(EMPTY);

  const editing = draft.code.trim().length === 2;
  const overridden = new Set(configs.map((c) => c.code.toUpperCase()));

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <Globe className="w-5 h-5 text-accent-cyan" /> Country settings
      </h1>
      <p className="text-xs text-text-muted -mt-2">
        All {listCountries().length} countries ship in the registry with regional defaults (tax, shipping,
        providers). Override any market below — providers, shipping, taxes, currency — and it goes live in
        the storefront region selector immediately.
      </p>

      {/* PSP catalog */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent-cyan" /> Payment service providers catalog
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Assign PSPs per country below. African mobile-money coverage: Flutterwave (cards + MoMo), MTN MoMo,
          Orange Money, M-Pesa, Wave, PayUnit, Onafriq, Paymob, Korapay.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
          {Object.values(PAYMENT_PROVIDERS).map((p) => (
            <div key={p.id} className="flex items-start gap-2 rounded-lg bg-surface-primary border border-border-hairline px-3 py-2">
              <span className="text-[9px] font-bold uppercase bg-noon text-noon-fg px-1.5 py-0.5 rounded mt-0.5">{p.badge}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold">{p.name}</div>
                <div className="text-[10px] text-text-muted leading-snug">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Country override editor */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm">{editing ? `Override ${draft.code}` : "Add / update a country"}</h3>
          {editing && (
            <button onClick={cancelEdit} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
          )}
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Code (FR)"
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm uppercase" />
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (France)"
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <input value={draft.flag} onChange={(e) => setDraft({ ...draft, flag: e.target.value })} placeholder="🇫🇷"
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} placeholder="Currency (EUR)"
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm uppercase" />
          <input value={draft.shipping} onChange={(e) => setDraft({ ...draft, shipping: e.target.value })} placeholder="Shipping (USD)"
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <input value={draft.tax_rate} onChange={(e) => setDraft({ ...draft, tax_rate: e.target.value })} placeholder="Tax rate (0.2)"
            className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {editing && <Check className="w-4 h-4 text-emerald-500" />} {draft.providers.length} PSP selected
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:col-span-4">
            {Object.entries(PAYMENT_PROVIDERS).map(([id, p]) => (
              <button key={id} onClick={() => toggleProvider(id)} title={p.desc}
                className={cn("px-2.5 py-1 rounded-md text-xs border transition",
                  draft.providers.includes(id) ? "bg-noon text-noon-fg border-noon font-medium" : "bg-surface-primary border-border-hairline text-text-muted")}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Save country
        </button>
      </div>

      {/* Overrides table */}
      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">Country</th><th className="py-2.5 px-4">Currency</th>
                <th className="py-2.5 px-4">Shipping</th><th className="py-2.5 px-4">Tax</th>
                <th className="py-2.5 px-4">PSPs</th><th className="py-2.5 px-4">Live</th><th />
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 px-4 font-medium">{c.flag} {c.name} <span className="text-text-muted text-xs">({c.code})</span></td>
                  <td className="py-2.5 px-4">{c.currency}</td>
                  <td className="py-2.5 px-4 text-mono">{c.shipping}</td>
                  <td className="py-2.5 px-4 text-mono">{Math.round((c.tax_rate || 0) * 100)}%</td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {(c.providers || []).map((p) => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-secondary border border-border-hairline">
                          {PAYMENT_PROVIDERS[p]?.name || p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <button onClick={() => toggleEnabled(c)}
                      className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                        c.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-surface-secondary text-text-muted")}>
                      {c.enabled ? "enabled" : "disabled"}
                    </button>
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded-md hover:bg-surface-secondary text-text-muted hover:text-text-primary" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(c)} className="p-1.5 rounded-md hover:bg-surface-secondary text-red-600" title="Delete override">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {configs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-text-muted text-xs">
                    No overrides — the built-in {listCountries().length}-country registry with regional PSP
                    bundles is in use. Pick any country above to customize its providers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Registry summary */}
      {!loading && (
        <p className="text-[11px] text-text-muted">
          Registry: {listCountries().length} countries · {overridden.size} overridden in the back office.
        </p>
      )}
    </div>
  );
}