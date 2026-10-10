import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Play, Pause, RefreshCw, RotateCcw, XCircle, Activity, Cpu, Plus, MessageSquare } from "lucide-react";
import { api } from "@/api/client";
import AddSourceDialog from "./AddSourceDialog";
import SourceDiscovery from "./SourceDiscovery";
import { cn } from "@/lib/utils";

const STATUS_COLOR = {
  ACTIVE: "text-emerald-600",
  PAUSED: "text-text-muted",
  WARNING: "text-amber-600",
  ERROR: "text-red-600",
  DISABLED: "text-text-muted",
};
const JOB_STATUS_COLOR = {
  QUEUED: "text-text-muted",
  RUNNING: "text-accent-cyan",
  RETRYING: "text-amber-600",
  FAILED: "text-red-600",
  COMPLETED: "text-emerald-600",
  CANCELLED: "text-text-muted",
};

const DIAGNOSTIC_COLS = [
  { key: "urls_discovered", label: "URLs disc." },
  { key: "products_discovered", label: "Enqueued" },
  { key: "products_found", label: "Found" },
  { key: "products_validated", label: "Validated" },
  { key: "products_rejected", label: "Rejected", warn: true },
  { key: "images_found", label: "Images ok" },
  { key: "images_failed", label: "Images KO", warn: true },
  { key: "products_failed", label: "Errors", warn: true },
];

export default function CrawlerPanel({ onChanged }) {
  const [sources, setSources] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, j] = await Promise.all([
        api.entities.CrawlerSource.list("-created_date", 50),
        api.entities.CrawlerJob.list("-updated_date", 200),
      ]);
      setSources(s);
      setJobs(j);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Runs ONE source only: discovery targets that source and the queue step is
  // scoped to its jobs, so no other site is touched.
  const runSource = async (source) => {
    setBusy(true);
    setMsg(null);
    try {
      const disc = await api.functions.invoke("crawlerRunSource", { source_id: source.id });
      const proc = await api.functions.invoke("crawlerProcessQueue", { max_jobs: 40, source_id: source.id });
      setMsg(
        `${source.name} — discovered ${disc.data.discovered} (enqueued ${disc.data.enqueued}) · processed ${proc.data.processed} (completed ${proc.data.completed}, retried ${proc.data.retried}, failed ${proc.data.failed})`
      );
      await load();
      if (onChanged) await onChanged();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Crawl failed");
    } finally {
      setBusy(false);
    }
  };

  const runAll = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let totalDiscovered = 0;
      for (const s of sources.filter((x) => x.enabled)) {
        const disc = await api.functions.invoke("crawlerRunSource", { source_id: s.id });
        totalDiscovered += disc.data.enqueued || 0;
      }
      const proc = await api.functions.invoke("crawlerProcessQueue", { max_jobs: 40 });
      setMsg(`Enqueued ${totalDiscovered} · processed ${proc.data.processed} (completed ${proc.data.completed}, failed ${proc.data.failed})`);
      await load();
      if (onChanged) await onChanged();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Crawl failed");
    } finally {
      setBusy(false);
    }
  };

  const processQueue = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.functions.invoke("crawlerProcessQueue", { max_jobs: 40 });
      setMsg(`Processed ${res.data.processed} · completed ${res.data.completed} · retried ${res.data.retried} · failed ${res.data.failed}`);
      await load();
      if (onChanged) await onChanged();
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || "Processing failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleSource = async (s) => {
    await api.entities.CrawlerSource.update(s.id, s.enabled ? { enabled: false, status: "PAUSED" } : { enabled: true, status: "ACTIVE" });
    load();
  };

  // Opt-in per source: import its public reviews only when their reuse is
  // legally permitted (real existing reviews, never generated).
  const toggleReviews = async (s) => {
    if (!s.reviews_enabled && !window.confirm(
      `Enable public review import for ${s.name}?\n\nOnly do this if the merchant publishes public reviews AND their reuse is permitted (check their terms / robots.txt). Only real existing reviews will be imported, verbatim.`
    )) return;
    await api.entities.CrawlerSource.update(s.id, { reviews_enabled: !s.reviews_enabled });
    load();
  };

  const retryJob = async (j) => {
    await api.entities.CrawlerJob.update(j.id, { status: "QUEUED", scheduled_at: new Date().toISOString(), attempts: 0, last_error: null });
    load();
  };
  const cancelJob = async (j) => {
    await api.entities.CrawlerJob.update(j.id, { status: "CANCELLED" });
    load();
  };

  const counts = jobs.reduce((m, j) => ({ ...m, [j.status]: (m[j.status] || 0) + 1 }), {});
  const errorJobs = jobs.filter((j) => j.status === "FAILED" || j.status === "RETRYING");
  const sourceName = (id) => sources.find((s) => s.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Queue status */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-accent-cyan" /> Queue status</h3>
            <p className="text-xs text-text-muted mt-1">Retry backoff: 1 min → 5 min → 15 min, then FAILED. Stale locks auto-recovered.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-semibold hover:border-accent-cyan/40 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add source
            </button>
            <button
              onClick={runAll}
              disabled={busy || sources.filter((s) => s.enabled).length === 0}
              className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-semibold hover:border-accent-cyan/40 disabled:opacity-40 flex items-center gap-2"
            >
              <Cpu className="w-4 h-4" /> Run all sources
            </button>
            <button
              onClick={processQueue}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", busy && "animate-spin")} /> Process queue now
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          {["QUEUED", "RUNNING", "RETRYING", "FAILED", "COMPLETED", "CANCELLED"].map((s) => (
            <div key={s} className="rounded-lg bg-surface-primary py-2">
              <div className="text-[9px] uppercase text-text-muted">{s}</div>
              <div className={cn("text-mono font-semibold", JOB_STATUS_COLOR[s])}>{counts[s] || 0}</div>
            </div>
          ))}
        </div>
        {msg && <div className="mt-3 rounded-lg bg-surface-primary p-3 text-sm">{msg}</div>}
      </div>

      {/* Source discovery & review — scan candidates before activation */}
      <SourceDiscovery onAdded={load} />

      {showAdd && (
        <AddSourceDialog
          onDone={(m) => { setShowAdd(false); setMsg(m || "Source added."); load(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Per-source diagnostic table */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5 overflow-x-auto">
        <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-accent-cyan" /> Source diagnostics ({sources.length})
        </h3>
        {loading ? (
          <div className="h-20 rounded-lg animate-pulse bg-surface-primary" />
        ) : sources.length === 0 ? (
          <p className="text-sm text-text-muted">No sources configured yet.</p>
        ) : (
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="text-left text-text-muted border-b border-border-hairline">
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                {DIAGNOSTIC_COLS.map((c) => (
                  <th key={c.key} className="py-2 pr-3 font-medium text-right">{c.label}</th>
                ))}
                <th className="py-2 pr-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-text-muted text-[10px] truncate max-w-[200px]">{s.feed_url || s.base_url}</div>
                    {s.last_run && <div className="text-text-muted text-[10px]">last run {new Date(s.last_run).toLocaleString()}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-md border border-current/30 font-medium", STATUS_COLOR[s.status])}>{s.status}</span>
                  </td>
                  {DIAGNOSTIC_COLS.map((c) => {
                    const v = s[c.key] || 0;
                    return (
                      <td key={c.key} className={cn("py-2.5 pr-3 text-right text-mono", c.warn && v > 0 ? "text-red-600" : "text-text-primary")}>
                        {v}
                      </td>
                    );
                  })}
                  <td className="py-2.5 pr-0 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => toggleReviews(s)}
                        title={s.reviews_enabled ? "Review import enabled — click to disable" : "Enable public review import (reuse must be permitted)"}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md border flex items-center gap-1",
                          s.reviews_enabled ? "border-accent-cyan text-accent-cyan" : "border-border-hairline text-text-muted hover:border-accent-cyan/40"
                        )}
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => runSource(s)}
                        disabled={busy || !s.enabled}
                        className="px-2.5 py-1.5 rounded-md border border-border-hairline flex items-center gap-1 hover:border-accent-cyan/40 disabled:opacity-40"
                      >
                        <Play className="w-3 h-3" /> Run
                      </button>
                      <button
                        onClick={() => toggleSource(s)}
                        className="px-2.5 py-1.5 rounded-md border border-border-hairline flex items-center gap-1 hover:border-accent-cyan/40"
                      >
                        {s.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                      <a
                        href={s.feed_url || s.base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-md border border-border-hairline hover:border-accent-cyan/40 inline-flex items-center"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rejected products / error queue: exact reason + retry */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="font-display font-semibold">Rejected products & crawler errors ({errorJobs.length})</h3>
        </div>
        <p className="text-xs text-text-muted mb-3">Exact rejection reason per product — fix the source or retry the job.</p>
        {errorJobs.length === 0 ? (
          <p className="text-sm text-text-muted flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> No failing jobs — pipeline healthy.</p>
        ) : (
          <div className="space-y-2">
            {errorJobs.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs py-2 border-b border-border-hairline last:border-0">
                <span className={cn("text-mono px-2 py-0.5 rounded border", JOB_STATUS_COLOR[j.status], "border-current/30")}>{j.status}</span>
                <span className="text-text-muted">{sourceName(j.source_id)}</span>
                <span className="text-mono text-text-muted truncate max-w-[240px]">{j.url || j.type}</span>
                <span className="text-red-600 truncate max-w-[280px]" title={j.last_error}>{j.last_error}</span>
                <span className="text-text-muted ml-auto whitespace-nowrap">
                  attempt {j.attempts}/{j.max_attempts}
                  {j.status === "RETRYING" && j.scheduled_at && ` · next ${new Date(j.scheduled_at).toLocaleTimeString()}`}
                </span>
                <button onClick={() => retryJob(j)} className="px-2 py-1 rounded-md border border-border-hairline hover:border-accent-cyan/40 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Retry</button>
                <button onClick={() => cancelJob(j)} className="px-2 py-1 rounded-md border border-border-hairline hover:border-red-400/40 flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> Ignore</button>
                {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-md border border-border-hairline hover:border-accent-cyan/40"><ExternalLink className="w-3 h-3" /></a>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}