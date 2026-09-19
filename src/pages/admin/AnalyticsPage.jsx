import React, { useCallback, useEffect, useState } from "react";
import { Package, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import { cn } from "@/lib/utils";

// Sales, active orders, category performance and search analytics.
export default function AnalyticsPage() {
  const { currency } = useRegion();
  const { tCat } = useLang();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        base44.entities.Order.list("-created_date", 200),
        base44.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 200),
      ]);
      setOrders(o);
      setProducts(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const paid = orders.filter((o) => ["PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(o.status));
  const activeOrders = orders.filter((o) => ["VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT"].includes(o.status));
  const installmentOrders = orders.filter((o) => (o.installment_count || 0) > 0);
  const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);

  // Category performance: catalog distribution among published products.
  const byCategory = Object.entries(
    products.reduce((m, p) => { m[p.category] = (m[p.category] || 0) + 1; return m; }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = byCategory[0]?.[1] || 1;

  if (loading) return <div className="h-40 bg-surface-card rounded-lg animate-pulse" />;

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-xl md:text-2xl">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[9px] uppercase tracking-widest text-text-muted">Sales (all currencies)</div>
          <div className="font-display font-bold text-2xl mt-1">{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[9px] uppercase tracking-widest text-text-muted flex items-center gap-1"><Package className="w-3 h-3" /> Active orders</div>
          <div className="font-display font-bold text-2xl mt-1">{activeOrders.length}</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[9px] uppercase tracking-widest text-text-muted flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Paid orders</div>
          <div className="font-display font-bold text-2xl mt-1">{paid.length}</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="text-[9px] uppercase tracking-widest text-text-muted">On installments</div>
          <div className="font-display font-bold text-2xl mt-1">{installmentOrders.length}</div>
        </div>
      </div>

      {/* Category performance — driven by the real crawled catalog */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <h3 className="font-display font-semibold mb-4">Category performance (published products)</h3>
        {byCategory.length === 0 ? (
          <p className="text-sm text-text-muted">No published products yet — run the crawler.</p>
        ) : (
          <div className="space-y-2">
            {byCategory.map(([cat, n]) => (
              <div key={cat} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-xs text-text-muted truncate">{tCat(cat)}</span>
                <div className="flex-1 h-5 bg-surface-primary rounded overflow-hidden">
                  <div className={cn("h-full rounded", n === maxCat ? "bg-noon" : "bg-accent-cyan/60")} style={{ width: `${Math.max(4, (n / maxCat) * 100)}%` }} />
                </div>
                <span className="text-mono text-xs w-8 text-right shrink-0">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search analytics + audit */}
      <AnalyticsPanel />
    </div>
  );
}