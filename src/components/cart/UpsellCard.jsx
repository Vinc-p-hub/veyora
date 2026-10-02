import React from "react";
import { Link } from "react-router-dom";
import { Plus, Check } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { usePricing } from "@/lib/PricingContext";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Compact one-tap cross-sell card. The TOTAL price stays the prominent figure
// and the installment is only ever shown underneath it — never instead of it.
export default function UpsellCard({ product }) {
  const { items, addItem } = useCart();
  const { currency } = useRegion();
  const { buildPlan } = usePricing();
  const inCart = items.some((i) => i.id === product.id);
  const plan = buildPlan(product.customer_price);

  return (
    <div className="w-40 md:w-44 shrink-0 bg-surface-card border border-border-hairline rounded-lg overflow-hidden flex flex-col">
      <Link to={`/product/${product.slug}`} className="block aspect-square bg-surface-secondary no-tap-highlight">
        <img src={product.image_url} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
      </Link>
      <div className="p-2.5 flex flex-col flex-1">
        <div className="text-[10px] uppercase text-text-muted truncate">{product.brand}</div>
        <Link to={`/product/${product.slug}`} className="text-xs font-medium leading-snug line-clamp-2 mt-0.5 hover:text-accent-cyan">
          {product.name}
        </Link>
        <div className="mt-auto pt-2">
          <div className="font-display font-bold text-sm">{formatPrice(product.customer_price, currency)}</div>
          {plan.count > 0 && (
            <div className="text-[10px] text-text-muted">
              or {formatPrice(plan.first_payment, currency)}/mo × {plan.count}
            </div>
          )}
        </div>
        <button
          onClick={() => addItem(product, 1)}
          disabled={inCart}
          className={cn(
            "mt-2 w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition",
            inCart ? "bg-emerald-50 text-emerald-600" : "bg-noon text-noon-fg hover:opacity-90"
          )}
        >
          {inCart ? <><Check className="w-3.5 h-3.5" /> In cart</> : <><Plus className="w-3.5 h-3.5" /> Add</>}
        </button>
      </div>
    </div>
  );
}