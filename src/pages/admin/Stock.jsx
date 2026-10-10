import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, History, PackageMinus, PackagePlus, X } from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const REASONS = ["MANUAL_ADD", "MANUAL_REMOVE", "MANUAL_ADJUST", "CORRECTION"];

export default function Stock() {
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [movements, setMovements] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("MANUAL_ADD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [rows, moves] = await Promise.all([
      api.entities.Product.list("-created_date", 400),
      api.entities.StockMovement.list("-created_date", 50),
    ]);
    setProducts(rows.filter((p) => (Number(p.veyro_stock) || 0) > 0 || (Number(p.reserved_stock) || 0) > 0));
    setMovements(moves);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (p) => {
    if (openId === p.id) { setOpenId(null); return; }
    setOpenId(p.id);
    setQty("");
    setReason("MANUAL_ADD");
    setError("");
  };

  const submit = async (p) => {
    const q = parseInt(qty, 10);
    if (!Number.isFinite(q) || q === 0) {
      setError("Enter a non-zero quantity, e.g. 5 or -3.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const oldStock = Number(p.veyro_stock) || 0;
      const newStock = Math.max(0, oldStock + q);
      await api.entities.Product.update(p.id, { veyro_stock: newStock });
      await api.entities.StockMovement.create({
        product_id: p.id,
        product_name: p.name,
        qty: q,
        old_stock: oldStock,
        new_stock: newStock,
        reason,
        actor_email: user?.email || "",
      });
      setOpenId(null);
      await load();
    } catch (e) {
      setError(e?.message || "Could not save the movement.");
    } finally {
      setBusy(false);
    }
  };

  if (!products) return <div className="h-40 bg-surface-card rounded-lg animate-pulse" />;

  const totalUnits = products.reduce((s, p) => s + (Number(p.veyro_stock) || 0), 0);
  const reserved = products.reduce((s, p) => s + (Number(p.reserved_stock) || 0), 0);
  const low = products.filter((p) => (Number(p.veyro_stock) || 0) - (Number(p.reserved_stock) || 0) <= 2).length;

  const stats = [
    { label: "SKUs with VEYRO stock", value: products.length, icon: Boxes },
    { label: "Units in warehouse", value: totalUnits, icon: PackagePlus },
    { label: "Reserved (pending orders)", value: reserved, icon: History },
    { label: "Free to sell (physical)", value: totalUnits - reserved, icon: PackageMinus },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl md:text-2xl">Stock & movements</h1>
        <span className="text-xs text-text-muted">{low} SKU(s) at or below 2 free units</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-card border border-border-hairline rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-widest text-text-muted">{s.label}</span>
              <s.icon className="w-4 h-4 text-accent-cyan" />
            </div>
            <div className="font-display font-bold text-2xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-hairline">
          <h3 className="font-display font-semibold">Warehouse inventory</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Real VEYRO physical stock. Every adjustment is recorded in the movement history below.
          </p>
        </div>
        <div className="overflow-x-auto">
          {products.length === 0 ? (
            <p className="px-5 py-8 text-sm text-text-muted text-center">No products carry VEYRO physical stock yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-3 py-3">In stock</th>
                  <th className="px-3 py-3">Reserved</th>
                  <th className="px-3 py-3">Free</th>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const free = (Number(p.veyro_stock) || 0) - (Number(p.reserved_stock) || 0);
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="border-b border-border-hairline/60">
                        <td className="px-5 py-3">
                          <Link to={`/admin/products/${p.id}`} className="hover:text-accent-cyan">{p.name}</Link>
                          <div className="text-[10px] text-text-muted">{p.brand} · {p.category}</div>
                        </td>
                        <td className="px-3 py-3 text-mono">{p.veyro_stock || 0}</td>
                        <td className="px-3 py-3 text-mono text-text-muted">{p.reserved_stock || 0}</td>
                        <td className={cn("px-3 py-3 text-mono font-semibold", free <= 2 ? "text-amber-600" : "")}>{free}</td>
                        <td className="px-3 py-3 text-xs text-text-muted">{String(p.stock_status || "").replace(/_/g, " ").toLowerCase()}</td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => startEdit(p)} className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs hover:border-accent-cyan/40">
                            Adjust
                          </button>
                        </td>
                      </tr>
                      {openId === p.id && (
                        <tr className="border-b border-border-hairline/60 bg-surface-secondary">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-text-muted">Quantity change:</span>
                              <input
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                placeholder="e.g. 5 or -3"
                                className="w-28 px-3 py-1.5 rounded-lg border border-border-hairline text-sm text-mono bg-surface-card"
                              />
                              <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-border-hairline text-sm bg-surface-card"
                              >
                                {REASONS.map((r) => <option key={r}>{r}</option>)}
                              </select>
                              <button
                                disabled={busy}
                                onClick={() => submit(p)}
                                className="px-4 py-1.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold disabled:opacity-50"
                              >
                                {busy ? "Saving…" : "Save movement"}
                              </button>
                              <button onClick={() => setOpenId(null)} className="p-1.5 rounded-lg hover:bg-surface-primary">
                                <X className="w-4 h-4" />
                              </button>
                              {error && <span className="text-xs text-red-600">{error}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border-hairline">
          <h3 className="font-display font-semibold">Movement history</h3>
          <p className="text-xs text-text-muted mt-0.5">Last 50 movements — manual adjustments and order fulfillments.</p>
        </div>
        {movements.length === 0 ? (
          <p className="px-5 py-8 text-sm text-text-muted text-center">No stock movement recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Change</th>
                  <th className="px-3 py-3">Before → after</th>
                  <th className="px-3 py-3">Reason</th>
                  <th className="px-3 py-3">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-border-hairline/60">
                    <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                      {m.created_date ? new Date(m.created_date).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3">{m.product_name || m.product_id}</td>
                    <td className={cn("px-3 py-3 text-mono font-semibold", (m.qty || 0) < 0 ? "text-red-600" : "text-emerald-600")}>
                      {(m.qty || 0) > 0 ? "+" : ""}{m.qty}
                    </td>
                    <td className="px-3 py-3 text-mono text-text-muted">{m.old_stock} → {m.new_stock}</td>
                    <td className="px-3 py-3 text-xs">{m.reason}</td>
                    <td className="px-3 py-3 text-xs text-text-muted">
                      {m.order_number ? `Order ${m.order_number}` : m.actor_email || "automation"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}