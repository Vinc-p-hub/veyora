import React, { useState } from "react";
import { Ticket, X } from "lucide-react";

const REASONS = {
  INVALID: "This code is invalid or expired.",
  MIN_ORDER: "Minimum order not reached for this code.",
  NOT_ELIGIBLE: "This code doesn't apply to the items in your cart.",
};

// Promo code entry — the code is validated SERVER-SIDE by checkoutRevalidate;
// `result` is the server's verdict for the applied code.
export default function CouponField({ applied, result, loading, onApply, onRemove }) {
  const [value, setValue] = useState("");

  if (applied && result?.valid) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <Ticket className="w-3.5 h-3.5" /> {result.code} applied{result.label ? ` · ${result.label}` : ""}
        </span>
        <button onClick={onRemove} className="text-emerald-700 hover:text-emerald-900" aria-label="Remove code">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (value.trim()) onApply(value.trim().toUpperCase()); }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Promo code"
          className="flex-1 min-w-0 bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-accent-cyan/50"
        />
        <button type="submit" disabled={loading || !value.trim()} className="px-3.5 py-2 rounded-lg border border-border-hairline text-sm font-medium hover:border-accent-cyan/40 disabled:opacity-40">
          {loading && applied ? "…" : "Apply"}
        </button>
      </form>
      {applied && result && !result.valid && !loading && (
        <p className="text-[11px] text-red-500 mt-1.5">{REASONS[result.reason] || REASONS.INVALID}</p>
      )}
    </div>
  );
}