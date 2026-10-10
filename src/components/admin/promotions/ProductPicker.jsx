import React, { useEffect, useState } from "react";
import { api } from "@/api/client";
import { INPUT } from "./promoForm";

export default function ProductPicker({ selected, onChange }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.entities.Product.filter({ status: "PUBLISHED" }, "name", 1000).then(setProducts);
  }, []);

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const term = q.trim().toLowerCase();
  const rows = (products || []).filter((p) => !term || `${p.brand} ${p.name}`.toLowerCase().includes(term)).slice(0, 40);

  return (
    <div className="border border-border-hairline rounded-lg p-2 space-y-2">
      <input className={INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search products · ${selected.length} selected`} />
      <div className="max-h-48 overflow-y-auto">
        {!products && <div className="p-2 text-xs text-text-muted">Loading products…</div>}
        {rows.map((p) => (
          <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer rounded hover:bg-surface-primary">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
            <span className="truncate flex-1">{p.brand} · {p.name}</span>
            <span className="text-mono text-text-muted">${p.customer_price}</span>
          </label>
        ))}
      </div>
    </div>
  );
}