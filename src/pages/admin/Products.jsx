import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "@/api/client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export default function Products() {
  const { currency } = useRegion();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("PUBLISHED");
  const [alloc, setAlloc] = useState(null); // { id, value }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.entities.Product.list("-created_date", 200);
      setProducts(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = products
    .filter((p) => only === "ALL" || p.status === only)
    .filter((p) => !q || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q.toLowerCase()));

  const setStatus = async (p, status) => {
    await api.entities.Product.update(p.id, { status });
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, status } : x)));
  };

  // Internal VEYRO sellable allocation — a commercial ceiling chosen by VEYRO,
  // never a claim about the supplier's real (crawled) stock status.
  const saveAlloc = async (p) => {
    const n = Math.max(0, Math.floor(Number(alloc.value) || 0));
    setAlloc(null);
    await api.entities.Product.update(p.id, {
      veyro_allocated_stock: n,
      available_to_sell: n,
      stock_changed_at: new Date().toISOString(),
    });
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, veyro_allocated_stock: n, available_to_sell: n } : x)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display font-bold text-xl md:text-2xl">Products ({visible.length})</h1>
        <div className="ms-auto flex items-center gap-2">
          <select value={only} onChange={(e) => setOnly(e.target.value)} className="bg-surface-card border border-border-hairline rounded-lg px-3 py-2 text-sm">
            {["PUBLISHED", "REVIEW", "REJECTED", "DISABLED", "ALL"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-2.5 text-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…"
              className="ps-9 pe-3 py-2 bg-surface-card border border-border-hairline rounded-lg text-sm w-44" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-surface-card border border-border-hairline rounded-lg p-3">
              <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <Link to={`/product/${p.slug}`} className="text-sm font-medium hover:text-accent-cyan">{p.name}</Link>
                <div className="text-xs text-text-muted">{p.brand} · {p.category} · score {p.premium_score} · via {p.source_name}</div>
                <div className="text-[10px] text-text-muted flex flex-wrap gap-x-2 items-center">
                  <span>Supplier stock: {(p.stock_status || "UNKNOWN").replace(/_/g, " ").toLowerCase()}</span>
                  {alloc?.id === p.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span>· Allocation:</span>
                      <input
                        type="number"
                        min="0"
                        value={alloc.value}
                        onChange={(e) => setAlloc({ id: p.id, value: e.target.value })}
                        className="w-16 px-1.5 py-0.5 border border-border-hairline rounded text-[10px]"
                      />
                      <button onClick={() => saveAlloc(p)} className="text-emerald-600 font-semibold hover:underline">Save</button>
                      <button onClick={() => setAlloc(null)} className="hover:underline">Cancel</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setAlloc({ id: p.id, value: String(p.veyro_allocated_stock ?? 0) })}
                      className="underline decoration-dotted hover:text-accent-cyan"
                      title="Adjust the internal VEYRO sellable allocation (does not change supplier stock)"
                    >
                      · VEYRO alloc: {p.veyro_allocated_stock ?? "—"} · Sellable: {p.available_to_sell ?? "—"} (adjust)
                    </button>
                  )}
                </div>
              </div>
              <div className="text-mono text-sm shrink-0">{formatPrice(p.customer_price, currency)}</div>
              <span className={cn("text-[10px] px-2 py-0.5 rounded shrink-0",
                p.status === "PUBLISHED" ? "text-emerald-600 bg-emerald-500/10" : p.status === "REVIEW" ? "text-amber-600 bg-amber-500/10" : "text-text-muted bg-surface-secondary")}>
                {p.status}
              </span>
              {p.status === "PUBLISHED" ? (
                <button onClick={() => setStatus(p, "DISABLED")} className="text-xs text-red-600 hover:underline shrink-0">Disable</button>
              ) : p.status === "DISABLED" ? (
                <button onClick={() => setStatus(p, "PUBLISHED")} className="text-xs text-emerald-600 hover:underline shrink-0">Publish</button>
              ) : null}
              <Link to={`/admin/products/${p.id}`} className="text-xs text-accent-cyan hover:underline shrink-0">Manage</Link>
            </div>
          ))}
          {visible.length === 0 && <p className="text-sm text-text-muted py-8 text-center">No products match.</p>}
        </div>
      )}
    </div>
  );
}