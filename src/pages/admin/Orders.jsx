import React, { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const STATUSES = ["PENDING_PAYMENT", "PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED", "PAYMENT_FAILED", "SUPPLIER_FAILURE"];

// Order management. Status changes here update the real order record (admin-only RLS).
// Actual money movement (refunds) is executed at the payment provider — record the
// refund here to keep the order state in sync.
export default function Orders() {
  const { currency } = useRegion();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await base44.entities.Order.list("-created_date", 100));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (o, status) => {
    await base44.entities.Order.update(o.id, { status });
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status } : x)));
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl">Orders ({orders.length})</h1>
      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">No orders yet.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="bg-surface-card border border-border-hairline rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono text-sm font-semibold flex items-center gap-1.5"><Package className="w-4 h-4 text-accent-cyan" />{o.order_number}</span>
                <span className="text-xs text-text-muted">{o.customer_email}</span>
                <span className="text-xs text-text-muted">{o.country || "—"} · {o.payment_provider || "—"}</span>
                <span className="text-mono text-sm font-semibold ms-auto">{formatPrice(o.total, o.currency === "USD" ? currency : { ...currency, rate: 1 })}</span>
                <select value={o.status} onChange={(e) => setStatus(o, e.target.value)}
                  className={cn("text-xs border rounded-lg px-2 py-1.5 bg-surface-primary border-border-hairline")}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="text-xs text-text-muted mt-1.5">
                {o.items?.length || 0} item(s)
                {(o.installment_count || 0) > 0 && ` · installment plan: ${o.installment_count}× (down ${o.down_payment})`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}