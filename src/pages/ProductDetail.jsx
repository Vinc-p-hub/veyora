import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, ShieldCheck, Truck, RefreshCw, Check, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { useCart } from "@/lib/CartContext";
import { formatPrice, PLAN_OPTIONS, getPlanForOption, buildInstallmentPlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { currency, country } = useRegion();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState("plan_5");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    base44.entities.Product.filter({ slug, status: "PUBLISHED" }, null, 1)
      .then((res) => setProduct(res[0] || null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="p-10 max-w-[1400px] mx-auto"><div className="aspect-[3/4] bg-surface-card rounded-lg animate-pulse max-w-md" /></div>;
  }
  if (!product) {
    return <div className="p-10 text-center text-text-muted">Product not found. <Link to="/category" className="text-accent-cyan">Browse catalog</Link></div>;
  }

  const price = product.customer_price;
  const plan = getPlanForOption(price, planId);
  const sourcePriceFmt = formatPrice(product.source_price, currency);
  const todayFmt = formatPrice(plan.downPayment, currency);
  const monthlyFmt = formatPrice(plan.installmentAmount, currency);
  const totalFmt = formatPrice(plan.totalPaid, currency);
  const shipping = country.shipping ? formatPrice(country.shipping, currency) : "Free";
  const tax = Math.round(price * country.taxRate * 100) / 100;

  const handleAdd = () => {
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const buyNow = () => {
    addItem(product, 1);
    navigate(`/checkout?plan=${planId}`);
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-6">
        <Link to="/" className="hover:text-text-primary">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/category?cat=${product.category}`} className="hover:text-text-primary">{product.category}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text-primary truncate">{product.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-card border border-border-hairline">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-primary/80 backdrop-blur border border-badge-premium/30 text-xs text-mono text-badge-premium">
              <ShieldCheck className="w-3.5 h-3.5" /> Premium {product.premium_score}%
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[product.image_url, product.image_url, product.image_url, product.image_url].map((img, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-surface-card border border-border-hairline opacity-70 hover:opacity-100 cursor-pointer transition">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted">{product.brand}</div>
            <h1 className="font-display font-bold text-2xl md:text-4xl mt-1.5 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-3 mt-3 text-sm text-text-muted">
              <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-badge-premium text-badge-premium" /> {product.rating}</span>
              <span>· {product.reviews_count} reviews</span>
              <span>· Match {Math.round(product.match_confidence * 100)}%</span>
            </div>
          </div>

          <p className="text-sm text-text-muted leading-relaxed">{product.description}</p>

          {/* Price + installment panel */}
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-text-muted">Total price</div>
                <div className="font-display font-bold text-3xl md:text-4xl mt-1">{formatPrice(price, currency)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-text-muted">Source price</div>
                <div className="text-mono text-text-muted line-through text-sm mt-1">{sourcePriceFmt}</div>
              </div>
            </div>

            {/* Plan selector */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Payment plan</div>
              <div className="grid grid-cols-2 gap-2">
                {PLAN_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPlanId(opt.id)}
                    className={cn(
                      "px-3 py-2.5 rounded-lg border text-sm transition text-left",
                      planId === opt.id ? "border-accent-cyan bg-accent-cyan/5 text-text-primary" : "border-border-hairline text-text-muted hover:text-text-primary"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-lg bg-surface-primary p-4 space-y-2.5">
              {plan.installmentCount === 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Pay today</span>
                  <span className="text-mono font-semibold text-accent-cyan">{totalFmt}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Pay today (down payment)</span>
                    <span className="text-mono font-semibold text-accent-cyan">{todayFmt}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Then {plan.installmentCount} monthly payments</span>
                    <span className="text-mono font-semibold">{monthlyFmt} / mo</span>
                  </div>
                  <div className="border-t border-border-hairline pt-2.5 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-text-muted">Total paid</span>
                    <span className="text-mono font-bold">{totalFmt}</span>
                  </div>
                </>
              )}
              <p className="text-[11px] text-text-muted leading-relaxed pt-1">
                No hidden costs. The total above is the full amount you pay across all installments.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                onClick={buyNow}
                className="flex-1 py-3.5 rounded-lg bg-noon text-noon-fg font-semibold text-sm hover:opacity-90 transition"
              >
                {plan.installmentCount === 0 ? `Buy now · ${todayFmt}` : `Prequalify · ${todayFmt} today`}
              </button>
              <button
                onClick={handleAdd}
                className={cn(
                  "px-5 py-3.5 rounded-lg border text-sm font-medium transition flex items-center gap-2",
                  added ? "border-emerald-400 text-emerald-400" : "border-border-hairline hover:border-accent-cyan/40"
                )}
              >
                {added ? <><Check className="w-4 h-4" /> Added</> : "Add to cart"}
              </button>
            </div>
          </div>

          {/* Trust row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border-hairline">
              <Truck className="w-5 h-5 text-accent-cyan" />
              <div className="text-xs">{product.delivery_days} day delivery</div>
              <div className="text-[10px] text-text-muted">{shipping} shipping</div>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border-hairline">
              <ShieldCheck className="w-5 h-5 text-accent-cyan" />
              <div className="text-xs">2-year warranty</div>
              <div className="text-[10px] text-text-muted">VEYRO verified</div>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border-hairline">
              <RefreshCw className="w-5 h-5 text-accent-cyan" />
              <div className="text-xs">30-day returns</div>
              <div className="text-[10px] text-text-muted">No questions</div>
            </div>
          </div>

          {/* Specs */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-3">Specifications</h3>
            <div className="rounded-lg border border-border-hairline overflow-hidden">
              {Object.entries(product.specifications || {}).map(([k, v], i) => (
                <div key={k} className={cn("flex justify-between px-4 py-3 text-sm", i % 2 === 0 ? "bg-surface-card" : "bg-surface-secondary")}>
                  <span className="text-text-muted">{k}</span>
                  <span className="text-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-text-muted border-t border-border-hairline pt-4">
            Sourced from <span className="text-text-primary">{product.source_name}</span>. Stock status: <span className="text-text-primary">{product.stock_status.replace(/_/g, " ").toLowerCase()}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}