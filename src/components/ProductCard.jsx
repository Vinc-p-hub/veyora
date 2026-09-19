import React from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { formatPrice, buildInstallmentPlan } from "@/lib/pricing";
import { useRegion } from "@/lib/RegionContext";

export default function ProductCard({ product, compact }) {
  const { currency } = useRegion();
  const price = product.customer_price;
  const plan = buildInstallmentPlan(price, 5, 0.15);
  const discount = product.source_price && product.source_price > price
    ? Math.round((1 - price / product.source_price) * 100)
    : 0;

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group flex flex-col bg-surface-card border border-border-hairline rounded-lg overflow-hidden hover:shadow-md transition no-tap-highlight"
    >
      <div className="relative aspect-square bg-surface-secondary overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
        />
        <span className="absolute bottom-2 left-2 text-[10px] italic font-bold text-white bg-accent-cyan px-1.5 py-0.5 rounded">express</span>
        {product.stock_status === "LOW_STOCK" && (
          <span className="absolute top-2 right-2 text-[10px] bg-white border border-border-hairline px-1.5 py-0.5 rounded text-text-muted">Low stock</span>
        )}
      </div>
      <div className="flex flex-col p-2.5 flex-1">
        <div className="text-[10px] uppercase text-text-muted">{product.brand}</div>
        <div className="text-xs font-medium leading-snug mt-0.5 line-clamp-2">{product.name}</div>
        {!compact && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-text-muted">
            <Star className="w-3 h-3 fill-badge-premium text-badge-premium" />
            {product.rating} <span className="text-text-muted/70">({product.reviews_count})</span>
          </div>
        )}
        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-display font-bold text-sm">{formatPrice(price, currency)}</span>
            {discount > 0 && (
              <span className="text-[11px] text-text-muted line-through">{formatPrice(product.source_price, currency)}</span>
            )}
          </div>
          {discount > 0 && <div className="text-[11px] font-semibold text-accent-cyan">{discount}% off</div>}
          <div className="text-[10px] text-text-muted mt-0.5">
            {formatPrice(plan.downPayment, currency)} today · {plan.installmentCount}× {formatPrice(plan.installmentAmount, currency)}/mo
          </div>
        </div>
      </div>
    </Link>
  );
}