import React from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import ProviderForm from "@/components/admin/psp/ProviderForm";

function Status({ provider }) {
  // Live provider running on the app's environment secrets, not the vault.
  if (provider.managed_by === "secrets") {
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium shrink-0 bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Live · app secrets
      </span>
    );
  }
  // The catalog entry exists but the provider's API contract is not wired yet —
  // keys can be stored, but it is never offered to customers.
  if (provider.implemented === false) {
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium shrink-0 bg-amber-100 text-amber-700">
        <AlertTriangle className="w-3 h-3" /> Integration pending
      </span>
    );
  }
  const ok = provider.configured;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium shrink-0",
        ok ? "bg-emerald-100 text-emerald-700" : "bg-surface-secondary text-text-muted"
      )}
    >
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {ok ? `${provider.mode}${provider.enabled ? "" : " · off"}` : "Not connected"}
    </span>
  );
}

export default function ProviderCard({ provider, open, onToggle, onSaved }) {
  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
      <button onClick={onToggle} className="w-full flex items-center gap-3 text-left no-tap-highlight">
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-sm">{provider.label}</div>
          <div className="text-[11px] text-text-muted truncate">{provider.region}</div>
        </div>
        <Status provider={provider} />
        {open ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>
      {open && <ProviderForm provider={provider} onSaved={onSaved} />}
    </div>
  );
}