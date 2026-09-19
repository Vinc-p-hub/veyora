import React from "react";
import { Link } from "react-router-dom";
import { Star, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import { useRegion } from "@/lib/RegionContext";
import { buildInstallmentPlan } from "@/lib/pricing";

export default function ProductCard({ product, compact }) {
  const { currency } = useRegion();
  const price = product.customer_price;
  const plan = buildInstallmentPlan(price, 5, 0.15);

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group flex flex-col bg-surface-card border border-border-hairline rounded-2xl overflow-hidden hover:border-accent-cyan/40 transition no-tap-highlight"
    >
      <div className="relative aspect-square bg-surface-secondary overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
        />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-surface-primary/80 backdrop-blur text-[10px] text-mono text-badge-premium border border-badge-premium/30">
          <ShieldCheck className="w-3 h-3" /> {product.premium_score}%
        </div>
        {product.stock_status === "LOW_STOCK" && (
          <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md bg-amber-500/90 text-[10px] text-surface-primary font-medium">Low stock</div>
        )}
      </div>
      <div className="flex flex-col p-3 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-text-muted">{product.brand}</div>
        <div className="text-sm font-medium leading-snug mt-0.5 line-clamp-2">{product.name}</div>
        {!compact && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-text-muted">
            <Star className="w-3 h-3 fill-badge-premium text-badge-premium" />
            {product.rating} <span className="text-text-muted/60">· {product.reviews_count} reviews</span>
          </div>
        )}
        <div className="mt-auto pt-3">
          <div className="font-display font-bold text-lg">{formatPrice(price, currency)}</div>
          <div className="text-[11px] text-mono text-accent-cyan/90">
            {formatPrice(plan.downPayment, currency)} today · {plan.installmentCount}× {formatPrice(plan.installmentAmount, currency)}/mo
          </div>
        </div>
      </div>
    </Link>
  );
}