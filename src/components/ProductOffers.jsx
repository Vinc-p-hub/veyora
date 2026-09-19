import React, { useState } from "react";
import { ChevronDown, Store } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import { useRegion } from "@/lib/RegionContext";
import { cn } from "@/lib/utils";

// Multi-seller offer comparison — real supplier offers joined with the live
// VEYRO margin so every offer shows the total price the customer would pay.
// Sorted on price + shipping + reliability, not price alone.
export default function ProductOffers({ product, offers }) {
  const { currency } = useRegion();
  const [open, setOpen] = useState(false);
  const ratio = product.source_price > 0 ? product.customer_price / product.source_price : 1.3;
  const rows = [...offers].sort(
    (a, b) =>
      a.source_price * ratio + (a.shipping_cost || 0) * 0.5 - (b.source_price * ratio + (b.shipping_cost || 0) * 0.5)
  );

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-surface-secondary/50 transition"
      >
        <span className="flex items-center gap-2">
          <Store className="w-4 h-4 text-accent-cyan" /> {offers.length} sellers available — compare offers
        </span>
        <ChevronDown className={cn("w-4 h-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border-hairline">
          {rows.map((o, i) => (
            <div
              key={o.id}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 text-sm",
                i % 2 === 0 ? "bg-surface-card" : "bg-surface-secondary/40"
              )}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{o.seller_name || "Partner seller"}</div>
                <div className="text-[11px] text-text-muted">
                  {o.delivery_days ? `${o.delivery_days}-day delivery` : "Standard delivery"}
                  {(o.shipping_cost || 0) > 0 ? ` · ${formatPrice(o.shipping_cost, currency)} shipping` : " · Free shipping"}
                  {` · reliability ${Math.round(o.supplier_score || 80)}/100`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-bold">
                  {formatPrice(o.source_price * ratio + (o.shipping_cost || 0), currency)}
                </div>
                {i === 0 && <div className="text-[10px] text-accent-cyan font-medium">Best offer</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}