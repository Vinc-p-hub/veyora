import React, { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { api } from "@/api/client";

// Immutable audit trail — every role assignment and crawler run is logged here.
export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await api.entities.AuditLog.list("-created_date", 100));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-accent-cyan" /> Audit logs
      </h1>
      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">No audit entries yet.</p>
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">When</th><th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Action</th><th className="py-2.5 px-4">Target</th><th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 px-4 text-xs text-text-muted whitespace-nowrap">{new Date(l.created_date).toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs">{l.actor_email || "system"}</td>
                  <td className="py-2.5 px-4 text-xs font-medium text-mono">{l.action}</td>
                  <td className="py-2.5 px-4 text-xs text-text-muted">{l.target_type}{l.target_id ? ` · ${String(l.target_id).slice(0, 8)}` : ""}</td>
                  <td className="py-2.5 px-4 text-xs text-text-muted max-w-[320px] truncate">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}