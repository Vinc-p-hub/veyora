import React from "react";
import { DollarSign, ShoppingCart, Receipt, Package, AlertTriangle, Cpu, Activity, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildMetrics, money } from "./metrics";

export default function DashboardKpis({ data }) {
  const m = buildMetrics(data);
  const tiles = [
    { label: "Revenue 30d", value: money(m.revenue30), sub: `${m.orders30} orders in 30 days`, icon: DollarSign, accent: "text-emerald-600" },
    { label: "Avg order value", value: money(m.aov), sub: `${m.installmentCount} on installments`, icon: Receipt },
    { label: "Paid orders", value: m.paidCount, sub: `${m.statusCounts.CANCELLED || 0} cancelled · ${m.statusCounts.PAYMENT_FAILED || 0} failed`, icon: ShoppingCart },
    { label: "Active shipments", value: m.activeOrders, sub: "in fulfilment right now", icon: Activity, accent: m.activeOrders > 0 ? "text-amber-600" : "" },
    { label: "Products crawled", value: m.crawl.found, sub: `${m.crawl.validated} validated · ${m.crawl.rejected} rejected`, icon: Cpu },
    { label: "Live catalogue", value: m.catalog.published, sub: `${m.catalog.review} awaiting approval`, icon: Package },
    { label: "Crawler queue", value: m.jobsPending, sub: `${m.jobCounts.FAILED || 0} failed jobs`, icon: Layers, accent: m.jobCounts.FAILED > 0 ? "text-red-600" : "" },
    { label: "Crawler errors", value: m.crawl.failed, sub: `${m.crawl.imagesKo} images unusable`, icon: AlertTriangle, accent: m.crawl.failed > 0 ? "text-red-600" : "" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-[9px] uppercase tracking-widest text-text-muted">{t.label}</span>
            <t.icon className={cn("w-4 h-4 shrink-0", t.accent || "text-accent-cyan")} />
          </div>
          <div className="font-display font-bold text-2xl">{t.value}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}