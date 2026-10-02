import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { applySeo, itemListLd, seoTitle } from "@/lib/seo";

// SEO brand landing page — real published products for one brand only.
export default function Brand() {
  const { brand } = useParams();
  const brandName = decodeURIComponent(brand || "");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Exact match first; case-insensitive fallback for URLs built by hand or
    // by search engines (e.g. /brand/apple).
    base44.entities.Product.filter({ status: "PUBLISHED", brand: brandName }, "-premium_score", 60)
      .then(async (rows) => {
        if (cancelled) return;
        if (rows.length) {
          setProducts(rows);
        } else {
          const all = await base44.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 200);
          if (cancelled) return;
          setProducts(all.filter((p) => String(p.brand || "").toLowerCase() === brandName.toLowerCase()));
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [brandName]);

  useEffect(() => {
    const shown = products.slice(0, 20);
    const path = `/brand/${encodeURIComponent(brandName)}`;
    applySeo({
      title: seoTitle(`Buy ${brandName} Online`, "Best Prices, Deals & Installments"),
      description: `Buy ${brandName} online at VEYRO${shown.length ? ` — ${shown.length} products` : ""} from verified merchants. Transparent prices, real stock, worldwide delivery and flexible installments with the total always visible.`,
      path,
      image: shown[0]?.image_url,
      breadcrumbs: [{ name: "Home", path: "/" }, { name: brandName, path }],
      jsonLd: itemListLd(`${brandName} on VEYRO`, shown),
    });
  }, [brandName, products]);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto">
      <h1 className="font-display font-bold text-2xl md:text-3xl">{brandName} on VEYRO</h1>
      <p className="text-xs text-text-muted mt-1">
        {loading ? "Loading…" : `${products.length} product${products.length === 1 ? "" : "s"} from verified partner merchants`}
      </p>
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-surface-card rounded-lg animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-14 text-sm text-text-muted">
            No {brandName} products published yet. <Link to="/category" className="text-accent-cyan hover:underline">Browse the full catalog</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}