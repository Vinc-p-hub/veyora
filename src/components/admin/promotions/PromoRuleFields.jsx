import React from "react";
import { Chip, Field } from "./Field";
import { INPUT } from "./promoForm";

const TYPES = [["PERCENT", "% off"], ["FIXED", "$ off"], ["FREE_SHIPPING", "Free shipping"]];

export default function PromoRuleFields({ f, set }) {
  const isShipping = f.discount_type === "FREE_SHIPPING";
  const showMinOrder = f.kind === "COUPON" || isShipping;
  const num = (key) => ({ type: "number", min: "0", className: INPUT, value: f[key], onChange: (e) => set({ [key]: e.target.value }) });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TYPES.map(([v, l]) => <Chip key={v} on={f.discount_type === v} onClick={() => set({ discount_type: v })}>{l}</Chip>)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {!isShipping && <Field label={f.discount_type === "PERCENT" ? "Discount (%)" : "Discount (USD)"}><input {...num("value")} /></Field>}
        {showMinOrder && <Field label="Minimum order (USD)"><input {...num("min_order_usd")} /></Field>}
        {!isShipping && (
          <Field label={f.kind === "COUPON" ? "Max per order (USD, 0 = none)" : "Max per item (USD, 0 = none)"}>
            <input {...num("max_discount_usd")} />
          </Field>
        )}
        <Field label="Usage limit (0 = unlimited)"><input {...num("usage_limit")} /></Field>
        <Field label="Starts"><input type="datetime-local" className={INPUT} value={f.starts_at} onChange={(e) => set({ starts_at: e.target.value })} /></Field>
        <Field label="Ends"><input type="datetime-local" className={INPUT} value={f.ends_at} onChange={(e) => set({ ends_at: e.target.value })} /></Field>
      </div>
      {f.discount_type === "PERCENT" && Number(f.value) >= 30 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 rounded p-2">
          Above the default 30% VEYRO margin — the server caps every promotional price at the supplier cost, so you never sell at a loss.
        </p>
      )}
    </div>
  );
}