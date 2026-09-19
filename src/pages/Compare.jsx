import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GitCompare, Loader2, Plus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLang } from "@/lib/i18n";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice, buildInstallmentPlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const MAX = 4;
const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#F0F0F3"/><text x="60" y="64" font-size="12" fill="#787C8D" text-anchor="middle" font-family="sans-serif">VEYRO</text></svg>'
  );

export default function Compare() {
  const { t, tCat } = useLang();
  const { currency, country } = useRegion();
  const [params, setParams] = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean).slice(0, MAX);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  // Load compared products (real catalog records)
  useEffect(() => {
    if (!ids.length) {
      setProducts([]);
      return;
    }
    setLoading(true);
    Promise.all(ids.map((id) => base44.entities.Product.get(id).catch(() => null)))
      .then((res) => setProducts(res.filter(Boolean)))
      .finally(() => setLoading(false));
  }, [ids.join(",")]);

  // Search-as-you-type picker (same server engine as the main search)
  useEffect(() => {
    if (q.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke("searchProducts", {
          q, country: country.code, mode: "suggest", limit: 6,
        });
        setSuggestions((res.data.products || []).filter((p) => !ids.includes(p.id)));
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  const setIds = (next) => {
    const p = new URLSearchParams(params);
    if (next.length) p.set("ids", next.join(",")); else p.delete("ids");
    setParams(p);
  };
  const addProduct = (id) => {
    if (ids.length >= MAX || ids.includes(id)) return;
    setIds([...ids, id]);
    setQ(""); setSuggestions([]);
  };
  const removeProduct = (id) => setIds(ids.filter((x) => x !== id));

  const specKeys = [...new Set(products.flatMap((p) => Object.keys(p.specifications || {})))];
  const lowestPrice = Math.min(...products.map((p) => p.customer_price));

  const rows = [
    { label: t("compare.price"), render: (p) => <span className={cn("font-display font-bold", p.customer_price === lowestPrice && "text-accent-cyan")}>{formatPrice(p.customer_price, currency)}</span> },
    { label: t("nav.financing"), render: (p) => {
      const plan = buildInstallmentPlan(p.customer_price, 5, 0.15);
      return <span>{formatPrice(plan.downPayment, currency)} + {plan.installmentCount}× {formatPrice(plan.installmentAmount, currency)}{t("card.perMonth")}</span>;
    } },
    { label: t("compare.brand"), render: (p) => p.brand },
    { label: t("compare.category"), render: (p) => tCat(p.category) },
    { label: t("compare.rating"), render: (p) => `★ ${p.rating} (${p.reviews_count || 0})` },
    { label: t("compare.stock"), render: (p) => t(`stock.${p.stock_status || "UNKNOWN"}`) },
    { label: t("compare.delivery"), render: (p) => t("card.deliveryDays", { n: p.delivery_days || 5 }) },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <h1 className="font-display font-bold text-2xl md:text-3xl flex items-center gap-2">
        <GitCompare className="w-6 h-6 text-accent-cyan" /> {t("compare.title")}
      </h1>

      {/* Picker */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5">
        <h2 className="font-display font-semibold text-sm">{t("compare.addTitle")}</h2>
        <p className="text-xs text-text-muted mt-0.5 mb-3">{t("compare.addHint")}</p>
        <div className="relative">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("compare.search")}
            className="w-full bg-surface-primary border border-border-hairline rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent-cyan/50"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin absolute end-3 top-3 text-text-muted" />}
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 rounded-lg border border-border-hairline bg-surface-primary divide-y divide-border-hairline">
            {suggestions.map((p) => (
              <button key={p.id} onClick={() => addProduct(p.id)} disabled={ids.length >= MAX}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-card transition text-left disabled:opacity-40">
                <img src={p.image_url || FALLBACK_IMG} alt="" className="w-9 h-9 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.name}</div>
                  <div className="text-[10px] uppercase text-text-muted">{p.brand}</div>
                </div>
                <span className="text-xs font-semibold">{formatPrice(p.customer_price, currency)}</span>
                <Plus className="w-4 h-4 text-accent-cyan" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison table */}
      {loading ? (
        <div className="h-48 bg-surface-card rounded-xl animate-pulse" />
      ) : products.length === 0 ? (
        <div className="text-center py-14 text-sm text-text-muted">
          <p>{t("compare.empty")}</p>
          <p className="text-xs mt-1">{t("compare.emptyHint")}</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr>
                <th className="w-32" />
                {products.map((p) => (
                  <th key={p.id} className="p-4 align-top">
                    <Link to={`/product/${p.slug}`}>
                      <img src={p.image_url || FALLBACK_IMG} alt="" className="w-20 h-20 rounded-lg object-cover mx-auto" />
                    </Link>
                    <Link to={`/product/${p.slug}`} className="block text-xs font-medium mt-2 hover:text-accent-cyan">{p.name}</Link>
                    <button onClick={() => removeProduct(p.id)} className="text-[10px] text-red-600 hover:underline mt-1 inline-flex items-center gap-0.5">
                      <X className="w-3 h-3" /> {t("common.remove")}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={cn("border-t border-border-hairline", i % 2 === 0 ? "bg-surface-primary/60" : "")}>
                  <td className="p-3 text-[10px] uppercase tracking-widest text-text-muted">{row.label}</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-center">{row.render(p)}</td>
                  ))}
                </tr>
              ))}
              {specKeys.length > 0 && (
                <tr className="border-t border-border-hairline">
                  <td className="p-3 text-[10px] uppercase tracking-widest text-text-muted align-top">{t("compare.specs")}</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 align-top">
                      <div className="space-y-1">
                        {specKeys.map((k) => (
                          <div key={k} className="text-xs">
                            <span className="text-text-muted">{k}: </span>
                            <span className="text-mono">{(p.specifications || {})[k] ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}