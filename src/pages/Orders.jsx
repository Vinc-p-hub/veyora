import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Package, CreditCard, Clock, Check, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";

const STATUS_FLOW = ["PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
const STATUS_LABEL = {
  PAID: "Payment confirmed",
  VERIFYING_SUPPLIER: "Verifying supplier",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
};

export default function Orders() {
  const [params] = useSearchParams();
  const { currency } = useRegion();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(localStorage.getItem("veyro_email") || "");
  const [searched, setSearched] = useState(false);
  const placed = params.get("placed");

  const loadOrders = async (em) => {
    if (!em) return;
    setLoading(true);
    localStorage.setItem("veyro_email", em);
    const res = await base44.entities.Order.filter({ customer_email: em }, "-created_date", 50);
    setOrders(res);
    setSearched(true);
    setLoading(false);
  };

  useEffect(() => {
    if (placed && email) loadOrders(email);
    else setLoading(false);
  }, []);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1000px] mx-auto">
      {placed && (
        <div className="mb-6 p-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-400/20 flex items-center justify-center"><Check className="w-5 h-5 text-emerald-400" /></div>
          <div>
            <div className="font-medium text-sm">Order {placed} confirmed</div>
            <div className="text-xs text-text-muted">We've emailed your receipt and tracking details.</div>
          </div>
        </div>
      )}

      <h1 className="font-display font-bold text-2xl md:text-3xl mb-6">Your Orders</h1>

      {!searched ? (
        <div className="max-w-md">
          <p className="text-sm text-text-muted mb-4">Enter the email you used at checkout to view your orders and payment plans.</p>
          <div className="flex gap-2">
            <input
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadOrders(email)}
              className="flex-1 bg-surface-card border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50"
            />
            <button onClick={() => loadOrders(email)} className="px-5 rounded-lg bg-noon text-noon-fg font-medium text-sm">View</button>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-surface-card rounded-lg animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">No orders found for {email}.</p>
          <Link to="/category" className="text-accent-cyan text-sm mt-2 inline-block">Start shopping →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const stepIdx = STATUS_FLOW.indexOf(order.status);
            return (
              <div key={order.id} className="bg-surface-card border border-border-hairline rounded-lg overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border-hairline">
                  <div>
                    <div className="text-mono text-xs text-text-muted">{order.order_number}</div>
                    <div className="text-sm font-medium mt-0.5">{order.items?.length || 0} item(s) · {order.country}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-lg">{formatPrice(order.total, currency)}</div>
                    {order.installment_count > 0 && (
                      <div className="text-xs text-accent-cyan text-mono">{formatPrice(order.down_payment, currency)} paid · {order.installment_count}× {formatPrice(order.installment_amount, currency)}/mo</div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="p-4 space-y-2">
                  {order.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-text-muted">{it.brand} {it.name} ×{it.qty}</span>
                      <span className="text-mono">{formatPrice(it.price * it.qty, currency)}</span>
                    </div>
                  ))}
                </div>

                {/* Status tracker */}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                    {STATUS_FLOW.slice(0, 6).map((s, i) => (
                      <React.Fragment key={s}>
                        <div className={`flex flex-col items-center gap-1 shrink-0`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${i <= stepIdx ? "bg-noon text-noon-fg" : "bg-surface-secondary text-text-muted"}`}>
                            {i < stepIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                          </div>
                          <span className={`text-[9px] whitespace-nowrap ${i <= stepIdx ? "text-text-primary" : "text-text-muted"}`}>{STATUS_LABEL[s]}</span>
                        </div>
                        {i < 5 && <div className={`h-0.5 w-6 md:w-10 ${i < stepIdx ? "bg-noon" : "bg-border-hairline"}`} />}
                      </React.Fragment>
                    ))}
                  </div>
                  {order.tracking_number && order.status !== "PAID" && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-text-muted">
                      <Truck className="w-3.5 h-3.5" /> Tracking: <span className="text-mono text-text-primary">{order.tracking_number}</span>
                    </div>
                  )}
                </div>

                {/* Installment schedule */}
                {order.installment_count > 0 && (
                  <div className="border-t border-border-hairline p-4 bg-surface-secondary">
                    <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest text-text-muted"><CreditCard className="w-3.5 h-3.5" /> Installment schedule</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-surface-card p-2.5">
                        <div className="text-[9px] text-text-muted uppercase">Today (paid)</div>
                        <div className="text-mono text-sm text-emerald-400">{formatPrice(order.down_payment, currency)}</div>
                      </div>
                      {Array.from({ length: Math.min(order.installment_count, 3) }).map((_, i) => (
                        <div key={i} className="rounded-lg bg-surface-card p-2.5">
                          <div className="text-[9px] text-text-muted uppercase">Month {i + 1}</div>
                          <div className="text-mono text-sm">{formatPrice(order.installment_amount, currency)}</div>
                          <div className="text-[9px] text-text-muted flex items-center justify-center gap-0.5"><Clock className="w-2.5 h-2.5" /> Due</div>
                        </div>
                      ))}
                      {order.installment_count > 3 && (
                        <div className="rounded-lg bg-surface-card p-2.5">
                          <div className="text-[9px] text-text-muted uppercase">+{order.installment_count - 3} more</div>
                          <div className="text-mono text-sm text-text-muted">{formatPrice(order.installment_amount, currency)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}