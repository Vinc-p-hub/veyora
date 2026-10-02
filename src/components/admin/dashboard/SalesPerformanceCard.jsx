import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildMetrics, salesSeries, topProducts, money, ORDER_STATUSES } from "./metrics";

const STATUS_TONE = {
  COMPLETED: "text-emerald-600",
  DELIVERED: "text-emerald-600",
  PAID: "text-emerald-600",
  PROCESSING: "text-accent-cyan",
  SHIPPED: "text-accent-cyan",
  IN_TRANSIT: "text-accent-cyan",
  VERIFYING_SUPPLIER: "text-amber-600",
  PENDING_PAYMENT: "text-amber-600",
  CANCELLED: "text-red-600",
  PAYMENT_FAILED: "text-red-600",
  SUPPLIER_FAILURE: "text-red-600",
};

export default function SalesPerformanceCard({ data }) {
  const orders = data?.orders || [];
  const rates = data?.rates || [];
  const m = buildMetrics(data);
  const series = useMemo(() => salesSeries(orders, rates, 14), [orders, rates]);
  const top = useMemo(() => topProducts(orders, rates, 6), [orders, rates]);
  const total14 = series.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-cyan" /> Sales performance
        </h3>
        <span className="text-xs text-text-muted">last 14 days · {money(total14)}</span>
      </div>
      <p className="text-[11px] text-text-muted mb-3">
        Converted to USD at the live currency rates. Lifetime paid revenue: {money(m.revenueAll)}.
      </p>

      <div className="h-48 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E4E5EE" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#787C8D" }} axisLine={false} tickLine={false} interval={1} />
            <Tooltip
              cursor={{ fill: "rgba(0,156,163,0.06)" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #E4E5EE", fontSize: 12 }}
              formatter={(v, _n, p) => [`$${Number(v).toLocaleString()} · ${p.payload.orders} order(s)`, "Revenue"]}
            />
            <Bar dataKey="revenue" fill="#009CA3" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Orders by status</div>
          <div className="space-y-1">
            {ORDER_STATUSES.filter((s) => (m.statusCounts[s] || 0) > 0).map((s) => (
              <div key={s} className="flex items-center justify-between text-xs py-1 border-b border-border-hairline last:border-0">
                <span className={cn("text-mono", STATUS_TONE[s] || "text-text-muted")}>{s}</span>
                <span className="font-medium">{m.statusCounts[s]}</span>
              </div>
            ))}
            {orders.length === 0 && <p className="text-xs text-text-muted">No orders yet.</p>}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Top products</div>
          {top.length === 0 ? (
            <p className="text-xs text-text-muted">No paid orders yet.</p>
          ) : (
            <div className="space-y-1">
              {top.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border-hairline last:border-0">
                  <span className="truncate">{p.brand ? `${p.brand} ` : ""}{p.name}</span>
                  <span className="text-text-muted whitespace-nowrap">{p.qty}× · {money(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}