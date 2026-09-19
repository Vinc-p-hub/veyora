import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Database, AlertTriangle, Cpu, Package, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [products, sources, jobs, orders] = await Promise.all([
        base44.entities.Product.list("-premium_score", 200),
        base44.entities.CrawlerSource.list("-created_date", 50),
        base44.entities.CrawlerJob.list("-updated_date", 200),
        base44.entities.Order.list("-created_date", 100),
      ]);
      setData({
        published: products.filter((p) => p.status === "PUBLISHED").length,
        review: products.filter((p) => p.status === "REVIEW").length,
        sources,
        failedJobs: jobs.filter((j) => j.status === "FAILED").length,
        orders,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-40 bg-surface-card rounded-lg animate-pulse" />;

  const paidOrders = data.orders.filter((o) => o.status === "PAID" || o.status === "PROCESSING" || o.status === "SHIPPED" || o.status === "DELIVERED" || o.status === "COMPLETED");
  const revenue = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const activeOrders = data.orders.filter((o) => ["VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT"].includes(o.status)).length;

  const stats = [
    { label: "Published products", value: data.published, icon: Database },
    { label: "In approval queue", value: data.review, icon: AlertTriangle, accent: data.review > 0 ? "amber" : "" },
    { label: "Active sources", value: data.sources.filter((s) => s.status === "ACTIVE").length, icon: Cpu },
    { label: "Crawler errors", value: data.failedJobs, icon: AlertTriangle, accent: data.failedJobs > 0 ? "red" : "" },
    { label: "Orders (all time)", value: data.orders.length, icon: Package },
    { label: "Active orders", value: activeOrders, icon: Activity, accent: activeOrders > 0 ? "amber" : "" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl md:text-2xl">Overview</h1>
        <Link to="/admin/sources" className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold">Open crawler console</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-card border border-border-hairline rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-widest text-text-muted">{s.label}</span>
              <s.icon className={cn("w-4 h-4", s.accent === "red" ? "text-red-600" : s.accent === "amber" ? "text-amber-600" : "text-accent-cyan")} />
            </div>
            <div className="font-display font-bold text-2xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
          <h3 className="font-display font-semibold mb-4">Source health</h3>
          {data.sources.length === 0 ? (
            <p className="text-sm text-text-muted">No sources configured.</p>
          ) : (
            <div className="space-y-3">
              {data.sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-text-muted truncate">{s.name}</span>
                  <span className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    s.status === "ACTIVE" ? "text-emerald-600" : s.status === "WARNING" ? "text-amber-600" : s.status === "ERROR" ? "text-red-600" : "text-text-muted"
                  )}>
                    {s.status} · {s.products_updated || 0} ok / {s.products_failed || 0} failed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
          <h3 className="font-display font-semibold mb-4">Revenue (all currencies)</h3>
          <div className="font-display font-bold text-3xl">{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-xs text-text-muted mt-1">Sum of paid order totals across all countries. Installment plans: {paidOrders.filter((o) => (o.installment_count || 0) > 0).length}.</p>
        </div>
      </div>
    </div>
  );
}