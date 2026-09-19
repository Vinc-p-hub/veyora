import React, { useEffect, useState } from "react";
import { History } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Admin action history — every approval, rejection, hide or deletion of a
// review is audit-logged (REVIEW_CUSTOMER_* / REVIEW_SOURCE_*).
export default function ModerationLogPanel() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    base44.entities.AuditLog.list("-created_date", 200)
      .then((rows) => setLogs(rows.filter((l) => (l.action || "").startsWith("REVIEW_"))))
      .catch(() => setLogs([]));
  }, []);

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-accent-cyan" /> Moderation history
      </h3>
      {logs === null ? (
        <div className="h-20 rounded-lg animate-pulse bg-surface-primary" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-text-muted">No moderation action recorded yet.</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 text-xs py-1.5 border-b border-border-hairline last:border-0">
              <span className="text-mono font-semibold">{l.action}</span>
              <span className="text-text-muted">by {l.actor_email || "—"}</span>
              <span className="text-text-muted truncate max-w-[180px]">target {l.target_id}</span>
              {l.details && <span className="text-amber-700">· {l.details}</span>}
              <span className="text-text-muted ms-auto">{new Date(l.created_date).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}