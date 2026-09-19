import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const STOCK_COLOR = {
  IN_STOCK: "text-emerald-600",
  LOW_STOCK: "text-amber-600",
  PREORDER: "text-accent-cyan",
  OUT_OF_STOCK: "text-red-600",
  UNKNOWN: "text-text-muted",
};

// All offers across the marketplace — one row per seller × product pair
// (PRODUCT / SELLER / OFFER separation). Supplier prices are stored in USD.
export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [seller, setSeller] = useState("ALL");
  const [staleOnly, setStaleOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, p, s] = await Promise.all([
        base44.entities.Offer.list("-last_checked", 500),
        base44.entities.Product.list("-created_date", 500),
        base44.entities.Seller.list("name", 200),
      ]);
      setOffers(o);
      setProducts(p);
      setSellers(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const productById = useMemo(() => {
    const map = new Map();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const visible = useMemo(() => offers.filter((o) => {
    if (seller !== "ALL" && o.seller_name !== seller) return false;
    if (staleOnly && !o.stale) return false;
    if (q) {
      const pn = productById.get(o.product_id)?.name || "";
      if (!`${pn} ${o.seller_name || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  }), [offers, q, seller, staleOnly, productById]);

  const multiSellerCount = useMemo(() => {
    const byProduct = {};
    for (const o of offers) byProduct[o.product_id] = (byProduct[o.product_id] || 0) + 1;
    return Object.values(byProduct).filter((n) => n > 1).length;
  }, [offers]);

  const usd = (v) => `$${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
          <Tag className="w-5 h-5 text-accent-cyan" /> Offers
        </h1>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <select value={seller} onChange={(e) => setSeller(e.target.value)} className="bg-surface-card border border-border-hairline rounded-lg px-3 py-2 text-sm">
            <option value="ALL">All sellers</option>
            {sellers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter product or seller…"
            className="px-3 py-2 bg-surface-card border border-border-hairline rounded-lg text-sm w-48" />
          <button onClick={() => setStaleOnly(!staleOnly)}
            className={cn("px-3 py-2 rounded-lg text-sm border transition",
              staleOnly ? "bg-amber-500/10 border-amber-300 text-amber-700 font-medium" : "border-border-hairline text-text-muted")}>
            Stale only
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total offers", value: offers.length },
          { label: "Sellers", value: sellers.length },
          { label: "Multi-seller products", value: multiSellerCount },
          { label: "Stale offers", value: offers.filter((o) => o.stale).length },
        ].map((c) => (
          <div key={c.label} className="bg-surface-card border border-border-hairline rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">{c.label}</div>
            <div className="text-mono font-bold text-xl mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Seller</th>
                <th className="py-2.5 px-4">Supplier price (USD)</th>
                <th className="py-2.5 px-4">Orig. currency</th>
                <th className="py-2.5 px-4">Supplier stock</th>
                <th className="py-2.5 px-4">Countries</th>
                <th className="py-2.5 px-4">Last checked</th>
                <th className="py-2.5 px-4">Freshness</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const p = productById.get(o.product_id);
                return (
                  <tr key={o.id} className="border-b border-border-hairline last:border-0">
                    <td className="py-2.5 px-4">
                      {p ? (
                        <Link to={`/product/${p.slug}`} className="text-sm font-medium hover:text-accent-cyan">{p.name}</Link>
                      ) : (
                        <span className="text-sm text-text-muted">Unknown product</span>
                      )}
                      {p && <div className="text-[10px] text-text-muted">{p.brand} · {p.category}</div>}
                    </td>
                    <td className="py-2.5 px-4 text-sm">{o.seller_name || "—"}</td>
                    <td className="py-2.5 px-4 text-mono">{usd(o.source_price)}</td>
                    <td className="py-2.5 px-4 text-mono text-text-muted">{o.supplier_currency || "USD"}</td>
                    <td className={cn("py-2.5 px-4 text-xs font-medium", STOCK_COLOR[o.stock_status] || STOCK_COLOR.UNKNOWN)}>
                      {(o.stock_status || "UNKNOWN").replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-text-muted">{(o.countries || []).length || "—"}</td>
                    <td className="py-2.5 px-4 text-xs text-text-muted">
                      {o.last_checked ? new Date(o.last_checked).toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                        o.stale ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-600")}>
                        {o.stale ? "stale" : "fresh"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 px-4 text-center text-text-muted text-xs">No offers match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}