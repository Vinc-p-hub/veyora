import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { applySeo } from "@/lib/seo";

const CATEGORIES = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
  // legacy values still present on older catalog records
  "Phones", "Computers", "TV", "Wearables",
];
const BRANDS = [
  "Apple", "Samsung", "Sony", "LG", "Microsoft", "Dell", "Lenovo", "ASUS", "Acer", "HP",
  "MSI", "Razer", "Canon", "Nikon", "Bose", "Sennheiser", "JBL", "Dyson", "Nintendo",
  "Xbox", "PlayStation", "GoPro", "Garmin", "Huawei", "Xiaomi", "Google", "OnePlus", "Nothing",
];

export default function Category() {
  const [params, setParams] = useSearchParams();
  const { country } = useRegion();
  const { t, tCat } = useLang();
  const [products, setProducts] = useState([]);
  const [fallback, setFallback] = useState([]);
  const [corrected, setCorrected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const q = params.get("q") || "";
  const cat = params.get("cat") || "";
  const brand = params.get("brand") || "";
  const sort = params.get("sort") || (q ? "relevance" : "premium");

  useEffect(() => {
    setLoading(true);
    setFallback([]);
    setCorrected(null);
    if (q) {
      // Server-side search: synonyms, typo tolerance, premium/availability ranking
      base44.functions
        .invoke("searchProducts", { q, country: country.code, mode: "search", limit: 60 })
        .then((res) => {
          setProducts(res.data.products || []);
          setFallback(res.data.fallback || []);
          setCorrected(res.data.corrected || null);
        })
        .finally(() => setLoading(false));
    } else {
      const filter = { status: "PUBLISHED" };
      if (cat) filter.category = cat;
      if (brand) filter.brand = brand;
      const sortField = sort === "price_low" ? "customer_price" : sort === "price_high" ? "-customer_price" : "-premium_score";
      base44.entities.Product.filter(filter, sortField, 60)
        .then(setProducts)
        .finally(() => setLoading(false));
    }
  }, [q, cat, brand, sort, country.code]);

  // client-side refinement of server-ranked results
  const visible = useMemo(() => {
    let list = [...products];
    if (q) {
      if (cat) list = list.filter((p) => p.category === cat);
      if (brand) list = list.filter((p) => p.brand === brand);
      if (sort === "price_low") list.sort((a, b) => a.customer_price - b.customer_price);
      if (sort === "price_high") list.sort((a, b) => b.customer_price - a.customer_price);
    }
    return list;
  }, [products, q, cat, brand, sort]);

  // SEO landing pages: every category / brand / search view gets a unique
  // title, meta description and canonical URL.
  useEffect(() => {
    const label = cat ? cat : q ? `"${q}"` : "All products";
    applySeo({
      title: `${label} | VEYRO Premium Electronics`,
      description: `Shop ${label.toLowerCase()} on VEYRO — premium electronics marketplace with verified partner merchants, transparent pricing, real stock and flexible installments.`,
      path: `${window.location.pathname}${window.location.search}`,
    });
  }, [cat, q, brand]);

  const setParam = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next);
  };

  const title = cat ? tCat(cat) : q ? `${t("category.results")} "${q}"` : t("category.allProducts");

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl">{title}</h1>
          <p className="text-xs text-text-muted mt-1">{t("category.count", { n: visible.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="bg-surface-card border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50"
          >
            {q && <option value="relevance">{t("category.sortRelevance")}</option>}
            <option value="premium">{t("category.sortPremium")}</option>
            <option value="price_low">{t("category.sortPriceLow")}</option>
            <option value="price_high">{t("category.sortPriceHigh")}</option>
          </select>
          <button onClick={() => setShowFilters((s) => !s)} className="md:hidden p-2.5 rounded-lg border border-border-hairline">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {corrected && (
        <button
          onClick={() => setParam("q", corrected)}
          className="mb-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-noon text-noon-fg text-sm font-medium"
        >
          <Sparkles className="w-4 h-4" /> {t("category.didYouMean")} “{corrected}”?
        </button>
      )}

      <div className="flex gap-6">
        <aside className={`${showFilters ? "block" : "hidden"} md:block w-full md:w-56 shrink-0 space-y-6`}>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2.5">{t("category.category")}</div>
            <div className="space-y-1">
              <button onClick={() => setParam("cat", "")} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${!cat ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>{t("common.all")}</button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setParam("cat", c)} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${cat === c ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>{tCat(c)}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2.5">{t("category.brand")}</div>
            <div className="space-y-1">
              <button onClick={() => setParam("brand", "")} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${!brand ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>{t("common.all")}</button>
              {BRANDS.map((b) => (
                <button key={b} onClick={() => setParam("brand", b)} className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm ${brand === b ? "text-accent-cyan bg-surface-card" : "text-text-muted hover:text-text-primary"}`}>{b}</button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-surface-card rounded-lg animate-pulse" />)}
            </div>
          ) : visible.length === 0 ? (
            <div>
              <div className="text-center py-10 text-text-muted">
                <p className="text-sm">{q ? t("category.noMatchQuery", { q }) : t("category.noMatch")}</p>
              </div>
              {fallback.length > 0 && (
                <>
                  <h2 className="font-display font-semibold text-lg mb-3">{t("category.maybeLike")}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {fallback.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {visible.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}