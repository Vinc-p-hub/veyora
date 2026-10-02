import React, { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { Cpu, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildMetrics, crawlSeries } from "./metrics";

const SOURCE_TONE = {
  ACTIVE: "text-emerald-600",
  WARNING: "text-amber-600",
  ERROR: "text-red-600",
  PAUSED: "text-text-muted",
  DISABLED: "text-text-muted",
};

const STAT = [
  { key: "urls", label: "URLs discovered" },
  { key: "found", label: "Products found" },
  { key: "validated", label: "Validated" },
  { key: "rejected", label: "Rejected", warn: true },
  { key: "updated", label: "Updated" },
  { key: "imagesOk", label: "Images ok" },
  { key: "imagesKo", label: "Images unusable", warn: true },
  { key: "failed", label: "Errors", warn: true },
];

export default function CrawlerVolumeCard({ data }) {
  const m = buildMetrics(data);
  const series = useMemo(() => crawlSeries(data?.products || [], 14), [data]);
  const last14 = series.reduce((s, d) => s + d.count, 0);
  const sources = [...(data?.sources || [])].sort((a, b) => (b.products_found || 0) - (a.products_found || 0));

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent-cyan" /> Crawler volume
        </h3>
        <span className="text-xs text-text-muted">{last14} new in 14 days</span>
      </div>
      <p className="text-[11px] text-text-muted mb-3">
        Products discovered by the pipeline, per day — {m.catalog.total} in the catalogue, {m.catalog.imageIncomplete} with an incomplete gallery.
      </p>

      <div className="h-32 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#787C8D" }} axisLine={false} tickLine={false} interval={2} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #E4E5EE", fontSize: 12 }}
              formatter={(v) => [`${v} product(s)`, "Discovered"]}
            />
            <Area type="monotone" dataKey="count" stroke="#FEEE00" strokeWidth={2} fill="#FEEE00" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {STAT.map((s) => (
          <div key={s.key} className="rounded-lg bg-surface-primary py-2 px-2">
            <div className="text-[9px] uppercase text-text-muted truncate">{s.label}</div>
            <div className={cn("text-mono text-sm font-semibold", s.warn && m.crawl[s.key] > 0 ? "text-red-600" : "text-text-primary")}>
              {m.crawl[s.key]}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Volume per source</div>
        {sources.length === 0 ? (
          <p className="text-xs text-text-muted">No sources configured.</p>
        ) : (
          <div className="space-y-1">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-border-hairline last:border-0">
                <span className="truncate">{s.name}</span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-mono">{s.products_found || 0} found</span>
                  <span className="text-mono text-text-muted">{s.products_validated || 0} ok</span>
                  <span className={cn("font-medium", SOURCE_TONE[s.status] || "text-text-muted")}>{s.status}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg bg-surface-primary p-3 text-[11px] text-text-muted flex items-start gap-2">
        {m.jobCounts.FAILED > 0 || m.jobCounts.RETRYING > 0 ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
        )}
        <span>
          Queue: {m.jobCounts.QUEUED || 0} queued · {m.jobCounts.RUNNING || 0} running · {m.jobCounts.RETRYING || 0} retrying · {m.jobCounts.FAILED || 0} failed · {m.jobCounts.COMPLETED || 0} completed.
        </span>
      </div>
    </div>
  );
}