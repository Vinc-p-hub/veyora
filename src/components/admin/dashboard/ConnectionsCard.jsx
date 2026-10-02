import React from "react";
import { Link } from "react-router-dom";
import { Plug, ShieldCheck, ShieldAlert, Repeat, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildMetrics, timeAgo } from "./metrics";

const EVENT_TONE = {
  PROCESSED: "text-emerald-600",
  RECEIVED: "text-accent-cyan",
  DUPLICATE: "text-amber-600",
  INVALID_SIGNATURE: "text-red-600",
  TRANSACTION_MISMATCH: "text-red-600",
  INVALID_PAYLOAD: "text-red-600",
  ERROR: "text-red-600",
};

export default function ConnectionsCard({ data }) {
  const m = buildMetrics(data);
  const events = (data?.events || []).slice(0, 5);
  const sources = [...(data?.sources || [])].sort((a, b) => new Date(b.last_run || 0) - new Date(a.last_run || 0));
  const h = m.sourceHealth;

  const rows = [
    { label: "Payment providers", value: `${m.providers.enabled} enabled`, sub: `${m.providers.live} live · ${m.providers.test} test`, ok: m.providers.enabled > 0, to: "/admin/payment-providers" },
    { label: "Webhook signature checks", value: `${m.webhooks.processed} processed`, sub: m.webhooks.invalid ? `${m.webhooks.invalid} invalid signature(s)` : "no invalid signature", ok: m.webhooks.invalid === 0, to: "/admin/logs" },
    { label: "Crawler sources", value: `${h.ACTIVE || 0} active`, sub: `${h.WARNING || 0} warning · ${h.ERROR || 0} error`, ok: !h.ERROR, to: "/admin/sources" },
    { label: "Replay protection", value: `${m.webhooks.duplicates} duplicate(s)`, sub: m.webhooks.mismatch ? `${m.webhooks.mismatch} amount mismatch` : "no amount mismatch", ok: m.webhooks.mismatch === 0, to: "/admin/logs" },
  ];

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Plug className="w-4 h-4 text-accent-cyan" /> Connection status
        </h3>
        <span className="text-xs text-text-muted">{m.webhooks.total} event(s) received</span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <Link key={r.label} to={r.to} className="flex items-center gap-3 py-2 border-b border-border-hairline last:border-0 hover:opacity-80">
            {r.ok ? <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />}
            <span className="text-xs flex-1">
              <span className="font-medium">{r.label}</span>
              <span className="block text-text-muted">{r.sub}</span>
            </span>
            <span className="text-xs text-mono whitespace-nowrap">{r.value}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2 flex items-center gap-1.5">
          <Repeat className="w-3 h-3" /> Latest PSP events
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-text-muted">No PSP webhook received yet.</p>
        ) : (
          <div className="space-y-1">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-border-hairline last:border-0">
                <span className="text-text-muted uppercase text-[9px] w-16 shrink-0">{e.provider}</span>
                <span className="truncate flex-1">{e.event_type}</span>
                <span className={cn("font-medium whitespace-nowrap", EVENT_TONE[e.status] || "text-text-muted")}>{e.status}</span>
                <span className="text-text-muted whitespace-nowrap">{timeAgo(e.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Source reachability
        </div>
        {sources.length === 0 ? (
          <p className="text-xs text-text-muted">No sources configured.</p>
        ) : (
          <div className="space-y-1">
            {sources.slice(0, 5).map((s) => (
              <div key={s.id} className="text-[11px] py-1 border-b border-border-hairline last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className={cn("whitespace-nowrap", s.status === "ERROR" ? "text-red-600" : "text-text-muted")}>
                    {s.status} · {s.last_success ? `ok ${timeAgo(s.last_success)}` : "never succeeded"}
                  </span>
                </div>
                {s.last_error && <div className="text-red-600 truncate" title={s.last_error}>{s.last_error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}