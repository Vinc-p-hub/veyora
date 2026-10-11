import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Package, CreditCard, Clock, Check, Truck } from "lucide-react";
import { api } from "@/api/client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";
import PaymentEmbed, { EMBEDDED_PROVIDERS } from "@/components/payments/PaymentEmbed";
import { useConnectedProviders } from "@/lib/useConnectedProviders";
import { useAuth } from "@/lib/AuthContext";
import { readGuestOrders, rememberGuestOrder } from "@/lib/guestOrders";

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
  const { user, isLoadingAuth } = useAuth();
  const [email, setEmail] = useState(localStorage.getItem("veyro_email") || "");
  const [orderNumber, setOrderNumber] = useState(params.get("placed") || "");
  const [lookupError, setLookupError] = useState("");
  const [paying, setPaying] = useState(null); // resume an embedded payment inline
  const [choice, setChoice] = useState({}); // payment method picked per unpaid order
  const connected = useConnectedProviders();
  const placed = params.get("placed");

  const fetchOne = async (num, em) => {
    const res = await api.functions.invoke("payments", { action: "order_lookup", order_number: num, email: em });
    return res.data?.ok ? res.data.order : null;
  };

  // Signed-in customers see their account orders; guests see the orders remembered on this
  // device, or look one up with order number + e-mail. No account is ever required.
  const loadOrders = async () => {
    setLoading(true);
    setLookupError("");
    try {
      if (user) {
        const res = await api.functions.invoke("payments", { action: "my_orders" });
        const mine = res.data?.orders || [];
        const known = new Set(mine.map((o) => o.order_number));
        const extra = (await Promise.all(readGuestOrders().filter((g) => !known.has(g.n)).map((g) => fetchOne(g.n, g.e).catch(() => null)))).filter(Boolean);
        setOrders([...mine, ...extra].sort((x, y) => String(y.created_date).localeCompare(String(x.created_date))));
      } else {
        const list = (await Promise.all(readGuestOrders().map((g) => fetchOne(g.n, g.e).catch(() => null)))).filter(Boolean);
        setOrders(list);
      }
      setSearched(true);
    } catch (e) {
      setLookupError(e.message || "Could not load your orders");
    } finally {
      setLoading(false);
    }
  };

  const lookup = async () => {
    setLookupError("");
    try {
      const o = await fetchOne(orderNumber.trim().toUpperCase(), email.trim().toLowerCase());
      if (!o) throw new Error("No order matches these details");
      rememberGuestOrder(o.order_number, email);
      await loadOrders();
    } catch (e) {
      setLookupError(e.message || "No order matches these details");
    }
  };

  useEffect(() => {
    if (isLoadingAuth) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingAuth, user?.id]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1000px] mx-auto">
      {placed && (() => {
        const o = orders.find((x) => x.order_number === placed);
        const paid = o && o.status !== "PENDING_PAYMENT";
        if (!o) return null;
        return paid ? (
          <div className="mb-6 p-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-400/20 flex items-center justify-center"><Check className="w-5 h-5 text-emerald-400" /></div>
            <div>
              <div className="font-medium text-sm">Order {placed} confirmed</div>
              <div className="text-xs text-text-muted">Payment received. We've emailed your receipt and tracking details.</div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-lg border border-amber-400/40 bg-amber-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div>
              <div className="font-medium text-sm">Order {placed} is awaiting payment</div>
              <div className="text-xs text-text-muted">It is only confirmed once your payment goes through — complete it below.</div>
            </div>
          </div>
        );
      })()}

      <h1 className="font-display font-bold text-2xl md:text-3xl mb-6">Your Orders</h1>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-surface-card rounded-lg animate-pulse" />)}</div>
      ) : (
        <>
        {!user && (
          <div className="max-w-xl mb-6 p-4 rounded-lg border border-border-hairline bg-surface-card">
            <p className="text-sm font-medium mb-1">Find an order</p>
            <p className="text-xs text-text-muted mb-3">No account needed — enter your order number and the e-mail used at checkout.</p>
            <div className="flex flex-wrap gap-2">
              <input placeholder="Order number (VYR-…)" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
                className="flex-1 min-w-[160px] bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
              <input placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                className="flex-1 min-w-[160px] bg-surface-primary border border-border-hairline rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50" />
              <button onClick={lookup} className="px-5 rounded-lg bg-noon text-noon-fg font-medium text-sm">Find</button>
            </div>
            {lookupError && <p className="text-xs text-destructive mt-2">{lookupError}</p>}
          </div>
        )}
        {lookupError && user && <p className="text-xs text-destructive mb-3">{lookupError}</p>}
        {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">{user ? "You have no orders yet." : "No orders saved on this device yet — find one above with its number and e-mail."}</p>
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

                {/* Unpaid order: pick a method (if needed) and pay inline — no redirect */}
                {order.status === "PENDING_PAYMENT" && (() => {
                  const options = connected.filter((p) => EMBEDDED_PROVIDERS.includes(p.id));
                  const preferred = options.find((p) => p.id === order.payment_provider)?.id;
                  const chosen = choice[order.id] || preferred || (options.length === 1 ? options[0].id : null);
                  if (paying && paying.id === order.id && chosen) {
                    return (
                      <div className="border-b border-border-hairline p-4 bg-surface-secondary">
                        <PaymentEmbed
                          provider={chosen}
                          key={order.order_number + chosen}
                          orderNumber={order.order_number}
                          onPaid={() => { setPaying(null); loadOrders(email); }}
                        />
                      </div>
                    );
                  }
                  return (
                    <div className="border-b border-border-hairline px-4 py-3 bg-amber-50 space-y-2">
                      <div className="text-xs text-amber-700">Awaiting payment — this order is not confirmed yet.</div>
                      {options.length === 0 ? (
                        <div className="text-xs text-text-muted">Payments are temporarily unavailable. Please come back shortly.</div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {options.length > 1 && options.map((p) => (
                            <button key={p.id} onClick={() => setChoice((c) => ({ ...c, [order.id]: p.id }))}
                              className={`px-3 py-1.5 rounded-lg text-xs border ${chosen === p.id ? "bg-noon text-noon-fg border-transparent" : "border-border-hairline bg-white"}`}>
                              {p.label}
                            </button>
                          ))}
                          <button onClick={() => setPaying(order)} disabled={!chosen}
                            className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-xs font-semibold disabled:opacity-50">
                            Complete payment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

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
        </>
      )}
    </div>
  );
}