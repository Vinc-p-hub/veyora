import React, { useCallback, useEffect, useState } from "react";
import { Coins, Plus, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";

// Currency rate management (CurrencyRate records override the built-in registry
// app-wide, for every user, in real time — no code change needed).
export default function CurrencySettings() {
  const { toast } = useToast();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ code: "", symbol: "", rate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRates(await api.entities.CurrencyRate.list("code", 200));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addOrUpdate = async () => {
    const code = draft.code.trim().toUpperCase();
    const rate = parseFloat(draft.rate);
    if (!/^[A-Z]{3}$/.test(code) || !isFinite(rate) || rate <= 0) return;
    setSaving(true);
    try {
      const existing = rates.find((r) => r.code === code);
      if (existing) {
        await api.entities.CurrencyRate.update(existing.id, { symbol: draft.symbol || existing.symbol, rate });
      } else {
        await api.entities.CurrencyRate.create({ code, symbol: draft.symbol || "$", rate, updated_by: "admin" });
      }
      setDraft({ code: "", symbol: "", rate: "" });
      toast({ description: `Currency ${code} saved — active app-wide.` });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    await api.entities.CurrencyRate.delete(r.id);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <Coins className="w-5 h-5 text-accent-cyan" /> Currency rates
      </h1>
      <p className="text-xs text-text-muted -mt-2">
        Rates are stored as units per 1 USD. Adding or editing a currency here updates
        prices for every visitor immediately.
      </p>

      {/* Add / update form */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest text-text-muted">Code</span>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="EUR"
            className="mt-1 w-20 bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm uppercase" />
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest text-text-muted">Symbol</span>
          <input value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} placeholder="€"
            className="mt-1 w-20 bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest text-text-muted">Units per 1 USD</span>
          <input value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="0.92"
            className="mt-1 w-32 bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm" />
        </label>
        <button onClick={addOrUpdate} disabled={saving}
          className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Save
        </button>
      </div>

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">Code</th><th className="py-2.5 px-4">Symbol</th>
                <th className="py-2.5 px-4">Rate / USD</th><th className="py-2.5 px-4">Updated</th><th />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 px-4 font-semibold">{r.code}</td>
                  <td className="py-2.5 px-4">{r.symbol}</td>
                  <td className="py-2.5 px-4 text-mono">{r.rate}</td>
                  <td className="py-2.5 px-4 text-xs text-text-muted">{new Date(r.updated_date).toLocaleDateString()}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button onClick={() => remove(r)} className="text-red-600 hover:opacity-70"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr><td colSpan={5} className="py-6 px-4 text-center text-text-muted text-xs">No override records — the built-in defaults are in use.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}