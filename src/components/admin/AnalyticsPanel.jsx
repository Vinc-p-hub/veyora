import React, { useEffect, useMemo, useState } from "react";
import { Search, ClipboardList, TrendingDown } from "lucide-react";
import { api } from "@/api/client";

export default function AnalyticsPanel() {
  const [queries, setQueries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.entities.SearchQuery.list("-created_date", 200),
      api.entities.AuditLog.list("-created_date", 50),
    ])
      .then(([q, l]) => {
        setQueries(q);
        setLogs(l);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const byQuery = new Map();
    let zeroResults = 0;
    for (const q of queries) {
      const key = (q.query || "").toLowerCase().trim();
      if (!key) continue;
      const cur = byQuery.get(key) || { count: 0, zero: 0, last: q.created_date };
      cur.count += 1;
      if ((q.results_count || 0) === 0) cur.zero += 1;
      byQuery.set(key, cur);
      if ((q.results_count || 0) === 0) zeroResults += 1;
    }
    const top = [...byQuery.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
    return {
      total: queries.length,
      zeroResults,
      zeroRate: queries.length ? Math.round((zeroResults / queries.length) * 100) : 0,
      top,
    };
  }, [queries]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Tracked searches</div>
          <div className="font-display font-bold text-2xl mt-1">{stats.total}</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Zero-result rate</div>
          <div className="font-display font-bold text-2xl mt-1">{stats.zeroRate}%</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Zero-result queries</div>
          <div className="font-display font-bold text-2xl mt-1">{stats.zeroResults}</div>
        </div>
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4"><Search className="w-4 h-4 text-accent-cyan" /><h3 className="font-display font-semibold">Top searches</h3></div>
        {loading ? (
          <div className="h-16 animate-pulse bg-surface-primary rounded-lg" />
        ) : stats.top.length === 0 ? (
          <p className="text-sm text-text-muted">No searches tracked yet — try the search bar.</p>
        ) : (
          <div className="space-y-1.5">
            {stats.top.map(([q, s]) => (
              <div key={q} className="flex items-center justify-between text-sm py-1.5 border-b border-border-hairline last:border-0">
                <span className="font-medium">{q}</span>
                <span className="text-xs text-text-muted">
                  {s.count}× {s.zero > 0 && <span className="text-amber-600">· {s.zero} with 0 results</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4 text-accent-cyan" /><h3 className="font-display font-semibold">Audit log</h3></div>
        {loading ? (
          <div className="h-16 animate-pulse bg-surface-primary rounded-lg" />
        ) : logs.length === 0 ? (
          <p className="text-sm text-text-muted">No admin actions recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs py-2 border-b border-border-hairline last:border-0">
                <span className="text-mono text-accent-cyan px-1.5 py-0.5 rounded bg-surface-primary">{l.action}</span>
                <span className="text-text-muted">{l.actor_email}</span>
                <span className="truncate">{l.details}</span>
                <span className="text-text-muted ml-auto whitespace-nowrap">{l.created_date ? new Date(l.created_date).toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}