import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { promoStatus, promoValueText } from "@/lib/promotions";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  LIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200",
  PAUSED: "bg-surface-secondary text-text-muted border-border-hairline",
  EXPIRED: "bg-surface-secondary text-text-muted border-border-hairline",
  EXHAUSTED: "bg-amber-50 text-amber-700 border-amber-200",
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "—");

function scopeText(p) {
  if (p.scope === "CATEGORY") return (p.categories || []).join(", ") || "No category";
  if (p.scope === "BRAND") return (p.brands || []).join(", ") || "No brand";
  if (p.scope === "PRODUCT") return `${(p.product_ids || []).length} product(s)`;
  return "All products";
}

export default function PromotionRow({ promo, onToggle, onEdit, onDelete }) {
  const status = promoStatus(promo);
  return (
    <tr className="border-t border-border-hairline text-sm">
      <td className="px-4 py-3">
        <div className="font-medium">{promo.name}</div>
        <div className="text-[11px] text-text-muted">
          {promo.kind === "COUPON" ? <span className="text-mono">Code {promo.code}</span> : promo.label || "Automatic"}
        </div>
      </td>
      <td className="px-4 py-3 font-semibold whitespace-nowrap">
        {promoValueText(promo)}
        {promo.min_order_usd > 0 && <div className="text-[11px] font-normal text-text-muted">from ${promo.min_order_usd}</div>}
      </td>
      <td className="px-4 py-3 text-xs text-text-muted">{scopeText(promo)}</td>
      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{fmtDate(promo.starts_at)} → {fmtDate(promo.ends_at)}</td>
      <td className="px-4 py-3 text-xs text-mono">{promo.usage_count || 0}{promo.usage_limit > 0 ? ` / ${promo.usage_limit}` : ""}</td>
      <td className="px-4 py-3">
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", STATUS_STYLE[status])}>{status}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Switch checked={!!promo.active} onCheckedChange={() => onToggle(promo)} />
          <button onClick={() => onEdit(promo)} className="p-1.5 rounded hover:bg-surface-secondary" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => onDelete(promo)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}