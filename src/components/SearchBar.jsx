import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { formatPrice } from "@/lib/pricing";

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#F0F0F3"/><text x="60" y="64" font-size="12" fill="#787C8D" text-anchor="middle" font-family="sans-serif">VEYRO</text></svg>'
  );

export default function SearchBar() {
  const navigate = useNavigate();
  const { country, currency } = useRegion();
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const boxRef = useRef(null);

  // Debounced search-as-you-type — server-side engine with synonyms + typo tolerance
  useEffect(() => {
    if (q.trim().length < 1) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke("searchProducts", {
          q,
          country: country.code,
          mode: "suggest",
          limit: 6,
        });
        setData(res.data);
        setOpen(true);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [q, country.code]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) {
      setOpen(false);
      navigate(`/category?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const products = data?.products || [];
  const fallback = data?.fallback || [];
  const brands = data?.brands || [];
  const categories = data?.categories || [];

  return (
    <div ref={boxRef} className="relative flex-1 max-w-3xl flex min-w-0">
      <form onSubmit={submit} className="flex flex-1 min-w-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 1 && setOpen(true)}
          placeholder={t("header.searchPlaceholder")}
          className="flex-1 min-w-0 bg-white border border-border-hairline border-r-0 rounded-l-lg px-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          className="bg-noon px-4 md:px-6 rounded-r-lg flex items-center justify-center hover:bg-yellow-200 transition"
        >
          {loading ? <Loader2 className="w-5 h-5 text-noon-fg animate-spin" /> : <Search className="w-5 h-5 text-noon-fg" />}
        </button>
      </form>

      {open && q.trim().length >= 1 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-card border border-border-hairline rounded-lg shadow-2xl z-50 max-h-[70vh] overflow-auto">
          {loading && !data && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}

          {data?.corrected && (
            <button
              onClick={() => go(`/category?q=${encodeURIComponent(data.corrected)}`)}
              className="w-full text-left px-4 py-2.5 text-sm border-b border-border-hairline hover:bg-surface-secondary"
            >
              {t("category.didYouMean")} <span className="font-semibold text-accent-cyan">{data.corrected}</span>?
            </button>
          )}

          {products.length > 0 && (
            <>
              <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-widest text-text-muted">{t("search.products")}</div>
              {products.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-surface-secondary transition"
                >
                  <img src={p.image_url || FALLBACK_IMG} alt="" className="w-10 h-10 rounded object-cover bg-surface-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase text-text-muted">{p.brand}</div>
                    <div className="text-sm font-medium truncate">{p.name}</div>
                  </div>
                  <div className="text-sm font-semibold shrink-0">{formatPrice(p.customer_price, currency)}</div>
                </Link>
              ))}
            </>
          )}

          {(brands.length > 0 || categories.length > 0) && (
            <div className="px-4 py-2.5 border-t border-border-hairline flex flex-wrap gap-1.5">
              {brands.map((b) => (
                <button
                  key={b}
                  onClick={() => go(`/category?brand=${encodeURIComponent(b)}`)}
                  className="px-2.5 py-1 rounded-md bg-surface-primary border border-border-hairline text-xs font-medium hover:border-accent-cyan transition"
                >
                  {b}
                </button>
              ))}
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => go(`/category?cat=${encodeURIComponent(c)}`)}
                  className="px-2.5 py-1 rounded-md bg-noon text-noon-fg text-xs font-medium hover:opacity-80 transition"
                >
                  in {c}
                </button>
              ))}
            </div>
          )}

          {data && products.length === 0 && (
            <div className="p-4">
              <p className="text-sm text-text-muted">
                {fallback.length > 0 ? `${t("category.maybeLike")}…` : t("category.noMatchQuery", { q })}
              </p>
              {fallback.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 mt-2 p-2 rounded-lg hover:bg-surface-secondary transition"
                >
                  <img src={p.image_url || FALLBACK_IMG} alt="" className="w-10 h-10 rounded object-cover bg-surface-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase text-text-muted">{p.brand}</div>
                    <div className="text-sm font-medium truncate">{p.name}</div>
                  </div>
                  <div className="text-sm font-semibold shrink-0">{formatPrice(p.customer_price, currency)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}