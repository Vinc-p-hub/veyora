import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { formatPrice } from "@/lib/pricing";
import { usePricing } from "@/lib/PricingContext";
import ProductCard from "@/components/ProductCard";

// The 13 storefront categories — all connected to the real crawled catalog
// (products are auto-classified into these by the crawler pipeline).
const CATEGORIES = [
  { name: "Laptops", icon: "💻" },
  { name: "Smartphones", icon: "📱" },
  { name: "Tablets", icon: "🖥️" },
  { name: "Headphones & Earbuds", icon: "🎧" },
  { name: "TVs & Monitors", icon: "📺" },
  { name: "Cameras", icon: "📷" },
  { name: "Gaming", icon: "🎮" },
  { name: "Smartwatches", icon: "⌚" },
  { name: "Audio", icon: "🔊" },
  { name: "Accessories", icon: "🔌" },
  { name: "Smart Home", icon: "🏠" },
  { name: "Networking", icon: "📡" },
  { name: "Computer Components", icon: "⚙️" },
];

const BRANDS = [
  "Apple", "Samsung", "Sony", "LG", "Microsoft", "Dell", "Lenovo", "ASUS", "Acer", "HP",
  "MSI", "Razer", "Canon", "Nikon", "Bose", "Sennheiser", "JBL", "Dyson", "Nintendo",
  "Xbox", "PlayStation", "GoPro", "Garmin", "Huawei", "Xiaomi", "Google", "OnePlus", "Nothing",
];

export default function Home() {
  const { currency } = useRegion();
  const { t, tCat } = useLang();
  const { buildPlan } = usePricing();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 20)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const hero = products.find((p) => p.slug === "sony-wh-1000xm6-veyro-edition") || products[0];
  const heroPlan = hero ? buildPlan(hero.customer_price) : null;
  const trending = products.slice(0, 8);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 md:py-6 space-y-8 md:space-y-12">
      {/* Hero banner grid */}
      <section className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 bg-noon rounded-xl p-6 md:p-10 flex flex-col justify-between min-h-[340px] md:min-h-[380px]">
          <div>
            <span className="inline-block bg-noon-fg text-white text-[10px] font-bold px-3 py-1 rounded">{t("home.heroBadge")}</span>
            <h1 className="text-display font-extrabold text-noon-fg text-3xl md:text-5xl mt-4">
              {t("home.heroTitle1")}<br />{t("home.heroTitle2")}
            </h1>
            <p className="text-noon-fg/80 text-sm md:text-base mt-3 max-w-md">{t("home.heroSub")}</p>
            <Link to="/category" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-lg bg-noon-fg text-white text-sm font-semibold hover:opacity-90 transition">
              {t("home.shopNow")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {hero && heroPlan && (
            <Link
              to={`/product/${hero.slug}`}
              className="mt-6 flex items-center gap-4 bg-white rounded-lg p-3 md:p-4 max-w-md hover:shadow-md transition"
            >
              <img src={hero.image_url} alt={hero.name} className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg bg-surface-secondary" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase text-text-muted">{hero.brand}</div>
                <div className="text-sm font-semibold truncate">{hero.name}</div>
                <div className="text-xs text-accent-cyan font-medium">
                  {heroPlan.count > 0 ? (
                    <>
                      {formatPrice(heroPlan.first_payment, currency)}{t("card.perMonth")} · {t("card.paymentsTotal", { n: heroPlan.count, total: formatPrice(heroPlan.total, currency) })}
                    </>
                  ) : (
                    t("detail.total", { p: formatPrice(heroPlan.total, currency) })
                  )}
                </div>
              </div>
              <div className="font-display font-bold text-sm md:text-base shrink-0">{formatPrice(hero.customer_price, currency)}</div>
            </Link>
          )}
        </div>
        <div className="grid gap-3">
          <Link to="/financing-info" className="rounded-xl bg-accent-cyan text-white p-5 flex flex-col justify-between min-h-[165px] hover:opacity-95 transition">
            <span className="text-[10px] uppercase tracking-widest opacity-80">{t("nav.financing")}</span>
            <span className="font-display font-bold text-lg leading-tight">{t("home.installTitle")}</span>
            <span className="text-xs opacity-80">{t("home.installNote")}</span>
          </Link>
          <Link to="/financing-calculator" className="rounded-xl bg-noon-fg text-white p-5 flex flex-col justify-between min-h-[165px] hover:opacity-90 transition">
            <span className="text-[10px] uppercase tracking-widest opacity-70">{t("nav.financing")}</span>
            <span className="font-display font-bold text-lg leading-tight">{t("home.financingTitle")}<br />{t("home.financingSub")}</span>
            <span className="text-xs opacity-70">{t("home.financingNote")}</span>
          </Link>
        </div>
      </section>

      {/* Categories circles — all real catalog categories */}
      <section>
        <h2 className="font-display font-bold text-lg md:text-xl mb-4">{t("home.topCategories")}</h2>
        <div className="flex gap-5 md:gap-8 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((c) => (
            <Link
              key={c.name}
              to={`/category?cat=${encodeURIComponent(c.name)}`}
              className="flex flex-col items-center gap-2 shrink-0 no-tap-highlight group"
            >
              <span className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white border border-border-hairline flex items-center justify-center text-2xl md:text-3xl group-hover:border-accent-cyan transition">
                {c.icon}
              </span>
              <span className="text-xs text-text-muted group-hover:text-text-primary text-center leading-tight max-w-[88px]">{tCat(c.name)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recommended */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg md:text-xl">{t("home.recommended")}</h2>
          <Link to="/category" className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
            {t("home.viewAll")} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-surface-card rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {trending.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Brands — major premium electronics brands, discovered via real catalog */}
      <section className="bg-white border border-border-hairline rounded-xl p-5">
        <h2 className="font-display font-bold text-lg mb-4">{t("home.premiumBrands")}</h2>
        <div className="flex flex-wrap gap-2.5">
          {BRANDS.map((b) => (
            <Link
              key={b}
              to={`/category?brand=${encodeURIComponent(b)}`}
              className="px-4 py-2 rounded-lg bg-surface-primary border border-border-hairline text-xs font-medium hover:border-accent-cyan transition"
            >
              {b}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}