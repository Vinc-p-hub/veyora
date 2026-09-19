import React, { useCallback, useEffect, useState } from "react";
import { Headphones } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const STATUS_STYLE = { OPEN: "text-amber-600 bg-amber-500/10", IN_PROGRESS: "text-accent-cyan bg-accent-cyan/10", RESOLVED: "text-emerald-600 bg-emerald-500/10", CLOSED: "text-text-muted bg-surface-secondary" };

export default function SupportAdmin() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [only, setOnly] = useState("ALL");
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await base44.entities.SupportTicket.list("-created_date", 100));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (t, patch) => {
    setBusy(true);
    try {
      await base44.entities.SupportTicket.update(t.id, patch);
      toast({ description: `Ticket ${t.subject}: updated.` });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const visible = only === "ALL" ? tickets : tickets.filter((t) => t.status === only);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
          <Headphones className="w-5 h-5 text-accent-cyan" /> Support tickets ({visible.length})
        </h1>
        <select value={only} onChange={(e) => setOnly(e.target.value)}
          className="ms-auto bg-surface-card border border-border-hairline rounded-lg px-3 py-2 text-sm">
          {["ALL", ...STATUSES].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">No tickets.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <div key={t.id} className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold">{t.subject}</span>
                <span className="text-[10px] uppercase tracking-widest bg-surface-secondary text-text-muted px-1.5 py-0.5 rounded">{t.topic}</span>
                <span className={cn("text-[10px] px-2 py-0.5 rounded font-semibold uppercase", STATUS_STYLE[t.status])}>{t.status.replace(/_/g, " ")}</span>
                <span className="text-xs text-text-muted ms-auto">{t.email} · {new Date(t.created_date).toLocaleString()}</span>
              </div>
              <p className="text-sm text-text-muted">{t.message}</p>
              {t.order_number && <p className="text-xs text-text-muted">Order: <span className="text-mono">{t.order_number}</span></p>}
              {t.reply && <p className="text-xs border-t border-border-hairline pt-2"><span className="text-accent-cyan font-semibold">Reply:</span> {t.reply}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={replies[t.id] || ""}
                  onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })}
                  placeholder="Write a reply (sent to the customer's ticket view)…"
                  className="flex-1 min-w-[220px] bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm"
                />
                <select value={t.status} onChange={(e) => update(t, { status: e.target.value })}
                  className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-xs">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={() => update(t, { reply: replies[t.id] || "", status: "RESOLVED" })}
                  disabled={busy || !(replies[t.id] || "").trim()}
                  className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold disabled:opacity-40">
                  Reply & resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}