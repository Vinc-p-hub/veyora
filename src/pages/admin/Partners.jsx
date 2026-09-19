import React, { useCallback, useEffect, useState } from "react";
import { Handshake, Play, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

// Partner / merchant-source view: sync state, last success and success rate.
// Running a source here invokes the real discovery pipeline (crawlerRunSource).
export default function Partners() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSources(await base44.entities.CrawlerSource.list("-created_date", 50));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (s) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke("crawlerRunSource", { source_id: s.id });
      setMsg(`${s.name}: ${res.data.discovered} URLs discovered, ${res.data.enqueued} jobs enqueued — process them from the Crawler sources console.`);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <Handshake className="w-5 h-5 text-accent-cyan" /> Partners ({sources.length})
      </h1>
      {msg && <div className="rounded-lg bg-surface-card border border-border-hairline p-3 text-sm">{msg}</div>}

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sources.map((s) => {
            const total = (s.products_updated || 0) + (s.products_failed || 0);
            const rate = total ? Math.round(((s.products_updated || 0) / total) * 100) : 100;
            return (
              <div key={s.id} className="bg-surface-card border border-border-hairline rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{s.name}</div>
                    <a href={s.base_url} target="_blank" rel="noreferrer" className="text-xs text-text-muted hover:text-accent-cyan truncate block">
                      {s.base_url} <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium shrink-0 border border-current/30",
                    s.status === "ACTIVE" ? "text-emerald-600" : s.status === "WARNING" ? "text-amber-600" : s.status === "ERROR" ? "text-red-600" : "text-text-muted")}>
                    {s.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4">
                  <div className="rounded-lg bg-surface-primary py-2">
                    <div className="text-[9px] uppercase text-text-muted">Success rate</div>
                    <div className="font-semibold">{rate}%</div>
                  </div>
                  <div className="rounded-lg bg-surface-primary py-2">
                    <div className="text-[9px] uppercase text-text-muted">Products ok</div>
                    <div className="font-semibold">{s.products_updated || 0}</div>
                  </div>
                  <div className="rounded-lg bg-surface-primary py-2">
                    <div className="text-[9px] uppercase text-text-muted">Failed</div>
                    <div className="font-semibold">{s.products_failed || 0}</div>
                  </div>
                </div>
                <div className="text-[11px] text-text-muted mt-3">
                  Supplier score {s.supplier_score || 80} · adapter {s.adapter}
                  {s.last_success && ` · last sync ${new Date(s.last_success).toLocaleString()}`}
                  {(s.available_countries || []).length > 0 && ` · ${s.available_countries.length} markets`}
                </div>
                <button onClick={() => run(s)} disabled={busy || !s.enabled}
                  className="mt-3 w-full py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" /> Sync now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}