import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n";
import ProductCard from "@/components/ProductCard";

// Latest Arrivals — the freshest verified products from the crawler pipeline
// (real catalog data only; nothing is invented).
export default function NewArrivalsSection({ products }) {
  const { t } = useLang();
  if (!products || products.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-cyan" />
          {t("home.latestArrivals")}
        </h2>
        <Link to="/category" className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
          {t("home.viewAll")} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {products.slice(0, 8).map((p) => (
          <div key={p.id} className="relative">
            <span className="absolute z-10 top-2 start-2 text-[10px] font-bold bg-noon text-noon-fg px-1.5 py-0.5 rounded uppercase">
              {t("home.newBadge")}
            </span>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}