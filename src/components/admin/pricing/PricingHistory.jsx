import React from "react";
import { History } from "lucide-react";

// Change history — every pricing modification is logged with date, admin and
// old/new value (written server-side by the pricing engine).
export default function PricingHistory({ history }) {
  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <h3 className="font-display font-semibold flex items-center gap-2 mb-1">
        <History className="w-4 h-4 text-accent-cyan" /> Change history
      </h3>
      <p className="text-xs text-text-muted mb-4">Every rule change: date, admin, old → new value. Paid orders always keep their original price and plan.</p>
      {!history || history.length === 0 ? (
        <p className="text-sm text-text-muted">No changes yet.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-auto scrollbar-hide">
          {history.map((h) => (
            <div key={h.id} className="text-xs border-b border-border-hairline last:border-0 py-2">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-mono font-semibold">{h.field}</span>
                <span className="text-text-muted">by {h.admin_email}</span>
                <span className="text-text-muted ms-auto">{h.created_date ? new Date(h.created_date).toLocaleString() : ""}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                <code className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 truncate max-w-[240px]">{h.old_value}</code>
                <span className="text-text-muted">→</span>
                <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 truncate max-w-[240px]">{h.new_value}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}