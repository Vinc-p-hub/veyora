import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Search, Ban, Check, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { listCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

// Market control — VEYRO only sells where the Super Admin allows it.
// Every country in the registry is open for sale by default; blocking one
// removes it from the storefront delivery selector AND refuses checkout for it
// server-side (no order can ever be placed for a blocked country).
export default function Markets() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await base44.entities.CountryConfig.list("code", 300));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const blocked = useMemo(
    () => new Set(configs.filter((c) => c.enabled === false).map((c) => String(c.code).toUpperCase())),
    [configs]
  );
  const all = useMemo(() => [...listCountries()].sort((a, b) => a.name.localeCompare(b.name)), []);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));
  }, [all, q]);

  const configOf = (code) => configs.find((x) => String(x.code).toUpperCase() === code);

  const writeMarkets = async (list, enabled) => {
    const toUpdate = [];
    const toCreate = [];
    for (const c of list) {
      const existing = configOf(c.code);
      if (existing) toUpdate.push({ id: existing.id, enabled });
      else toCreate.push({
        code: c.code,
        name: c.name,
        currency: c.currency,
        flag: c.flag,
        shipping: c.shipping,
        tax_rate: c.taxRate,
        providers: c.providers,
        enabled,
      });
    }
    if (toUpdate.length) await base44.entities.CountryConfig.bulkUpdate(toUpdate);
    if (toCreate.length) await base44.entities.CountryConfig.bulkCreate(toCreate);
    await load();
  };

  const toggle = async (c) => {
    const isBlocked = blocked.has(c.code);
    setBusy(c.code);
    try {
      await writeMarkets([c], isBlocked);
      toast({
        description: isBlocked
          ? `${c.name} is open for sale again.`
          : `${c.name} blocked — removed from the storefront and checkout.`,
      });
    } finally {
      setBusy("");
    }
  };

  const bulk = async (enabled) => {
    if (!filtered.length) return;
    setBusy("bulk");
    try {
      await writeMarkets(filtered, enabled);
      toast({
        description: `${filtered.length} countr${filtered.length === 1 ? "y" : "ies"} ${enabled ? "open for sale" : "blocked"}.`,
      });
    } finally {
      setBusy("");
    }
  };

  const live = all.length - blocked.size;

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <Globe className="w-5 h-5 text-accent-cyan" /> Markets
      </h1>
      <p className="text-xs text-text-muted -mt-2">
        Choose exactly where VEYRO sells. Every country is open by default — block the ones you don't
        ship to: they disappear from the storefront delivery selector and any checkout for them is
        refused server-side.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest">Open for sale</span>
          </div>
          <div className="font-display font-bold text-2xl mt-1">{live}</div>
          <div className="text-[11px] text-text-muted">countries in the storefront</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600">
            <Ban className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest">Blocked</span>
          </div>
          <div className="font-display font-bold text-2xl mt-1">{blocked.size}</div>
          <div className="text-[11px] text-text-muted">countries VEYRO does not sell to</div>
        </div>
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-text-muted absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a country…"
              className="w-full bg-surface-primary border border-border-hairline rounded-lg ps-9 pe-3 py-2 text-sm outline-none focus:border-accent-cyan/50"
            />
          </div>
          <button
            onClick={() => bulk(false)}
            disabled={busy === "bulk" || !filtered.length}
            className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Ban className="w-3.5 h-3.5" /> Block these {filtered.length}
          </button>
          <button
            onClick={() => bulk(true)}
            disabled={busy === "bulk" || !filtered.length}
            className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Open these {filtered.length}
          </button>
        </div>
        <p className="text-[11px] text-text-muted">
          Bulk actions apply to the countries currently listed — search first (e.g. a region prefix) to
          target a group.
        </p>
      </div>

      {loading ? (
        <div className="h-40 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-hidden">
          {filtered.map((c, i) => {
            const isBlocked = blocked.has(c.code);
            return (
              <div
                key={c.code}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2.5",
                  i % 2 === 0 ? "bg-surface-card" : "bg-surface-secondary/40"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg leading-none">{c.flag}</span>
                  <div className="min-w-0">
                    <div className={cn("text-sm truncate", isBlocked && "text-text-muted line-through")}>{c.name}</div>
                    <div className="text-[10px] text-text-muted text-mono">{c.code} · {c.currency}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggle(c)}
                  disabled={busy === c.code}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold border transition disabled:opacity-40 flex items-center gap-1.5",
                    isBlocked
                      ? "border-red-300 text-red-600 hover:bg-red-50"
                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  {isBlocked ? <><Ban className="w-3.5 h-3.5" /> Blocked</> : <><Check className="w-3.5 h-3.5" /> Selling</>}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-text-muted">No country matches “{q}”.</div>
          )}
        </div>
      )}

      <p className="text-[11px] text-text-muted">
        Registry: {all.length} countries · {blocked.size} blocked. Shipping, taxes and payment providers
        per country stay configurable in Country settings.
      </p>
    </div>
  );
}