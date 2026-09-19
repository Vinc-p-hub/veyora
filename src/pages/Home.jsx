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

// Flat-lay hero imagery — premium tech composition (noon-style).
const FLATLAY = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80",
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80",
];
const HERO_MODEL = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80";

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
    <div>
      {/* Trilingual international ribbon */}
      <div className="bg-noon-fg text-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-8 flex items-center justify-between text-[10px] md:text-[11px] font-semibold uppercase tracking-widest">
          <span className="truncate">VEYRO · International Premium Electronics</span>
          <span className="shrink-0">🌍</span>
          <span className="truncate hidden md:inline">فاخر. عالمي. في متناول الجميع</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 md:py-6 space-y-8 md:space-y-12">
        {/* Hero grid — noon-style deal cards */}
        <section className="grid md:grid-cols-3 gap-3">
          {/* Today's top deals card */}
          <div className="md:col-span-2 rounded-xl bg-emerald-200 p-5 md:p-8 flex flex-col md:flex-row gap-5 md:gap-8 min-h-[300px] md:min-h-[340px]">
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <span className="inline-flex items-center justify-center w-14 h-14 bg-noon rotate-45 rounded-lg shrink-0 mb-4">
                  <span className="-rotate-45 font-display font-extrabold text-2xl leading-none">%</span>
                </span>
                <h1 className="text-display font-extrabold text-2xl md:text-4xl uppercase leading-tight">
                  {t("home.heroTitle1")}<br />{t("home.heroTitle2")}
                </h1>
                <p className="text-noon-fg/70 text-sm md:text-base mt-2 max-w-sm">{t("home.heroSub")}</p>
              </div>
              {hero && heroPlan && (
                <Link
                  to={`/product/${hero.slug}`}
                  className="mt-4 flex items-center gap-3 bg-white rounded-lg p-3 max-w-md hover:shadow-md transition"
                >
                  <img src={hero.image_url} alt={hero.name} className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg bg-surface-secondary" />
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
              <Link to="/category" className="mt-4 inline-flex items-center gap-2 self-start px-6 py-2.5 rounded-lg bg-noon-fg text-white text-sm font-semibold hover:opacity-90 transition">
                {t("home.shopNow")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {/* Flat-lay product composition */}
            <div className="hidden sm:grid grid-cols-2 gap-2 md:gap-3 w-[180px] md:w-64 shrink-0 self-center">
              {FLATLAY.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt="Premium electronics"
                  loading={i > 1 ? "lazy" : "eager"}
                  className="w-full aspect-square object-cover rounded-lg bg-white/60"
                />
              ))}
            </div>
          </div>

          {/* Secondary hero card */}
          <div className="relative rounded-xl overflow-hidden min-h-[240px] md:min-h-[340px] bg-surface-secondary group">
            <img
              src={HERO_MODEL}
              alt={t("home.heroBadge")}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute top-4 start-4 bg-noon text-noon-fg text-[10px] font-bold px-2.5 py-1 rounded uppercase">
              {t("home.heroBadge")}
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 flex gap-2">
              <Link to="/category" className="flex-1 text-center px-4 py-2.5 rounded-lg bg-white text-noon-fg text-xs md:text-sm font-semibold hover:bg-white/90 transition">
                {t("home.shopNow")}
              </Link>
              <Link to="/financing-info" className="flex-1 text-center px-4 py-2.5 rounded-lg bg-white text-noon-fg text-xs md:text-sm font-semibold hover:bg-white/90 transition">
                {t("nav.financing")}
              </Link>
            </div>
          </div>
        </section>

        {/* Categories tiles — all real catalog categories */}
        <section>
          <h2 className="font-display font-bold text-lg md:text-xl mb-4">{t("home.topCategories")}</h2>
          <div className="flex gap-3 md:gap-6 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((c) => (
              <Link
                key={c.name}
                to={`/category?cat=${encodeURIComponent(c.name)}`}
                className="flex flex-col items-center gap-2 shrink-0 no-tap-highlight group w-20 md:w-24"
              >
                <span className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white border border-border-hairline flex items-center justify-center text-2xl md:text-3xl group-hover:border-accent-cyan group-hover:shadow-md transition">
                  {c.icon}
                </span>
                <span className="text-xs text-text-muted group-hover:text-text-primary text-center leading-tight">{tCat(c.name)}</span>
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
    </div>
  );
}