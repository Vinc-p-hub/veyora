import React from "react";
import { Chip } from "./Field";
import { CATEGORIES, INPUT } from "./promoForm";
import ProductPicker from "./ProductPicker";

const SCOPES = [["ALL", "All products"], ["CATEGORY", "Categories"], ["BRAND", "Brands"], ["PRODUCT", "Specific products"]];

export default function PromoTargetFields({ f, set }) {
  const toggleCat = (c) =>
    set({ categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] });

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-text-muted">Applies to</div>
      <div className="flex flex-wrap gap-2">
        {SCOPES.map(([v, l]) => <Chip key={v} on={f.scope === v} onClick={() => set({ scope: v })}>{l}</Chip>)}
      </div>
      {f.scope === "CATEGORY" && (
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => <Chip key={c} on={f.categories.includes(c)} onClick={() => toggleCat(c)}>{c}</Chip>)}
        </div>
      )}
      {f.scope === "BRAND" && (
        <input className={INPUT} placeholder="Brands, comma-separated — e.g. Keychron, Glorious" value={f.brands} onChange={(e) => set({ brands: e.target.value })} />
      )}
      {f.scope === "PRODUCT" && <ProductPicker selected={f.product_ids} onChange={(ids) => set({ product_ids: ids })} />}
    </div>
  );
}