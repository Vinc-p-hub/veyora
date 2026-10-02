import React from "react";
import { cn } from "@/lib/utils";

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Chip({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg border text-xs transition",
        on ? "border-accent-cyan bg-accent-cyan/10 text-text-primary font-medium" : "border-border-hairline text-text-muted hover:border-accent-cyan/40"
      )}
    >
      {children}
    </button>
  );
}