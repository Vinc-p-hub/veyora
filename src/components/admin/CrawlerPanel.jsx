import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Play, Pause, RefreshCw, RotateCcw, XCircle, Activity, Cpu } from "lucide-react";
import { base44 } from "@/api/base44Client";
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

export default function CrawlerPanel({ onChanged }) {
  const [sources, setSources] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, j] = await Promise.all([
        base44.entities.CrawlerSource.list("-created_date", 50),
        base44.entities.CrawlerJob.list("-updated_date", 200),
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

  const runSource = async (id) => {
    setBusy(true);
    setMsg(null);
    try {
      const disc = await base44.functions.invoke("crawlerRunSource", { source_id: id });
      const proc = await base44.functions.invoke("crawlerProcessQueue", { max_jobs: 25 });
      setMsg(
        `Discovered ${disc.data.discovered} · processed ${proc.data.processed} (completed ${proc.data.completed}, retried ${proc.data.retried}, failed ${proc.data.failed})`
      );
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
      const res = await base44.functions.invoke("crawlerProcessQueue", { max_jobs: 25 });
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
    await base44.entities.CrawlerSource.update(s.id, s.enabled ? { enabled: false, status: "PAUSED" } : { enabled: true, status: "ACTIVE" });
    load();
  };

  const retryJob = async (j) => {
    await base44.entities.CrawlerJob.update(j.id, { status: "QUEUED", scheduled_at: new Date().toISOString(), attempts: 0, last_error: null });
    load();
  };
  const cancelJob = async (j) => {
    await base44.entities.CrawlerJob.update(j.id, { status: "CANCELLED" });
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
          <button
            onClick={processQueue}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", busy && "animate-spin")} /> Process queue now
          </button>
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

      {/* Sources */}
      <div className="space-y-3">
        <h3 className="font-display font-semibold flex items-center gap-2"><Cpu className="w-4 h-4 text-accent-cyan" /> Sources ({sources.length})</h3>
        {loading ? (
          <div className="h-20 bg-surface-card rounded-lg animate-pulse" />
        ) : sources.length === 0 ? (
          <p className="text-sm text-text-muted">No sources configured yet.</p>
        ) : (
          sources.map((s) => (
            <div key={s.id} className="bg-surface-card border border-border-hairline rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-md border", STATUS_COLOR[s.status], "border-current/30")}>{s.status}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {s.adapter} · every {s.crawl_interval_minutes} min · {s.enabled ? "enabled" : "disabled"}
                    {s.last_run && ` · last run ${new Date(s.last_run).toLocaleString()}`}
                    {s.last_error && ` · last error: ${s.last_error}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => runSource(s.id)}
                    disabled={busy || !s.enabled}
                    className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs flex items-center gap-1.5 hover:border-accent-cyan/40 disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" /> Run now
                  </button>
                  <button
                    onClick={() => toggleSource(s)}
                    className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs flex items-center gap-1.5 hover:border-accent-cyan/40"
                  >
                    {s.enabled ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
                  </button>
                  <a
                    href={s.feed_url || s.base_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs flex items-center gap-1.5 hover:border-accent-cyan/40"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                <Mini label="Discovered" value={s.products_discovered || 0} />
                <Mini label="Updated" value={s.products_updated || 0} />
                <Mini label="Failed" value={s.products_failed || 0} accent={(s.products_failed || 0) > 0 ? "red" : "default"} />
                <Mini label="Next run" value={s.next_run ? new Date(s.next_run).toLocaleTimeString() : "—"} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Error queue */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="font-display font-semibold">Crawler error queue ({errorJobs.length})</h3>
        </div>
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

function Mini({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-surface-primary py-2">
      <div className="text-[9px] uppercase text-text-muted">{label}</div>
      <div className={cn("text-mono font-semibold", accent === "red" ? "text-red-600" : "text-text-primary")}>{value}</div>
    </div>
  );
}