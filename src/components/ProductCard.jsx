import React from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { usePricing } from "@/lib/PricingContext";

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#F0F0F3"/><text x="60" y="64" font-size="12" fill="#787C8D" text-anchor="middle" font-family="sans-serif">VEYRO</text></svg>'
  );

export default function ProductCard({ product, compact }) {
  const { currency } = useRegion();
  const { t } = useLang();
  const { buildPlan } = usePricing();
  const price = product.customer_price;
  const plan = buildPlan(price);
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
          src={product.image_url || FALLBACK_IMG}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
        />
        <span className="absolute bottom-2 start-2 text-[10px] italic font-bold text-white bg-accent-cyan px-1.5 py-0.5 rounded">{t("card.express")}</span>
        {product.stock_status === "LOW_STOCK" && (
          <span className="absolute top-2 end-2 text-[10px] bg-white border border-border-hairline px-1.5 py-0.5 rounded text-text-muted">{t("stock.LOW_STOCK")}</span>
        )}
        {product.badge && (
          <span className="absolute top-2 start-2 text-[10px] font-bold bg-noon text-noon-fg px-1.5 py-0.5 rounded">{product.badge}</span>
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
          {/* First installment prominent, total ALWAYS visible right below —
              never let the first installment read as the product's full price. */}
          {plan.count > 0 ? (
            <>
              <div className="font-display font-bold text-sm text-accent-cyan">
                {formatPrice(plan.first_payment, currency)}{t("card.perMonth")}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {t("card.paymentsTotal", { n: plan.count, total: formatPrice(plan.total, currency) })}
              </div>
            </>
          ) : (
            <div className="font-display font-bold text-sm">{formatPrice(plan.total, currency)}</div>
          )}
          {discount > 0 && (
            <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
              <span className="text-[11px] text-text-muted line-through">{formatPrice(product.source_price, currency)}</span>
              <span className="text-[11px] font-semibold text-accent-cyan">{t("card.off", { n: discount })}</span>
            </div>
          )}
          <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
            <span className={product.stock_status === "IN_STOCK" ? "text-emerald-600 font-medium" : ""}>{t(`stock.${product.stock_status || "UNKNOWN"}`)}</span>
            <span>· {t("card.deliveryDays", { n: product.delivery_days || 5 })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}