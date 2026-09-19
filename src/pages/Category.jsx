import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";

const CATEGORIES = ["Phones", "Computers", "Gaming", "Audio", "Cameras", "TV", "Smart Home", "Wearables", "Accessories"];
const BRANDS = ["Apple", "Sony", "Bose", "Samsung", "Leica", "Bang & Olufsen", "Canon", "Nikon", "ASUS", "Dyson", "Sennheiser", "LG"];

export default function Category() {
  const [params, setParams] = useSearchParams();
  const { currency } = useRegion();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const brand = params.get("brand") || "";
  const sort = params.get("sort") || "premium";

  useEffect(() => {
    setLoading(true);
    const filter = { status: "PUBLISHED" };
    if (cat) filter.category = cat;
    if (brand) filter.brand = brand;
    const sortField = sort === "price_low" ? "customer_price" : sort === "price_high" ? "-customer_price" : "-premium_score";
    base44.entities.Product.filter(filter, sortField, 60)
      .then((all) => {
        let list = all;
        if (q) {
          const ql = q.toLowerCase();
          list = list.filter((p) => p.name.toLowerCase().includes(ql) || p.brand.toLowerCase().includes(ql) || p.category.toLowerCase().includes(ql));
        }
        setProducts(list);
      })
      .finally(() => setLoading(false));
  }, [q, cat, brand, sort]);

  const setParam = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next);
  };

  const title = cat || (q ? `Results for "${q}"` : "All Premium Electronics");

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">{title}</h1>
          <p className="text-xs text-text-muted mt-1">{products.length} verified premium products</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="bg-surface-card border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50"
          >
            <option value="premium">Premium score</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
          </select>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="md:hidden p-2.5 rounded-lg border border-border-hairline"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <aside className={`${showFilters ? "block" : "hidden"} md:block w-full md:w-56 shrink-0 space-y-6`}>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2.5">Category</div>
            <div className="space-y-1">
              <button onClick={() => setParam("cat", "")} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${!cat ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>All</button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setParam("cat", c)} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${cat === c ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2.5">Brand</div>
            <div className="space-y-1">
              <button onClick={() => setParam("brand", "")} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${!brand ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>All</button>
              {BRANDS.map((b) => (
                <button key={b} onClick={() => setParam("brand", b)} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${brand === b ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>{b}</button>
              ))}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-surface-card rounded-lg animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-text-muted">
              <p className="text-sm">No products match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}