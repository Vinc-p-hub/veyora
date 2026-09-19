import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { formatPrice } from "@/lib/pricing";
import { usePricing } from "@/lib/PricingContext";
import { Image } from "@/components/ui/image";
import ProductCard from "@/components/ProductCard";
import NewArrivalsSection from "@/components/NewArrivalsSection";

// Landing priority: flagship smartphones & laptops first, then computers and
// brand accessories — with the latest crawler arrivals front and center.
const CATEGORIES = [
  { name: "Smartphones", icon: "📱", fallback: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&q=80" },
  { name: "Laptops", icon: "💻", fallback: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80" },
  { name: "Computer Components", icon: "⚙️", fallback: null },
  { name: "Accessories", icon: "🔌", fallback: "https://images.unsplash.com/photo-1546868871-7041f2a55778?w=400&q=80" },
  { name: "Tablets", icon: "🖥️", fallback: "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400&q=80" },
  { name: "Headphones & Earbuds", icon: "🎧", fallback: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80" },
  { name: "TVs & Monitors", icon: "📺", fallback: "https://images.unsplash.com/photo-1593359677879-a4bb92f839d1?w=400&q=80" },
  { name: "Cameras", icon: "📷", fallback: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80" },
  { name: "Gaming", icon: "🎮", fallback: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80" },
  { name: "Smartwatches", icon: "⌚", fallback: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80" },
  { name: "Audio", icon: "🔊", fallback: null },
  { name: "Smart Home", icon: "🏠", fallback: null },
  { name: "Networking", icon: "📡", fallback: null },
];

const PRIORITY_ORDER = ["Smartphones", "Laptops", "Computer Components", "Accessories"];

// Real flagship product imagery (submitted references) — clickable hero tiles.
const HERO_IPHONES = "https://media.base44.com/images/public/6aae3bd1fa32640256bb8573/d4fab25ef_iphone-18-pro-model-unselect-gallery-1-202609.webp";
const HERO_IPHONE_CAM = "https://media.base44.com/images/public/6aae3bd1fa32640256bb8573/c366724f5_iphone-18-pro-finish-select-burgundy-202609_AV2.jpg";

const HERO_TILES = [
  { src: HERO_IPHONE_CAM, to: "/category?cat=Smartphones", optimized: true },
  { src: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80", to: "/category?cat=Laptops" },
  { src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80", to: "/category?cat=Headphones%20%26%20Earbuds" },
  { src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80", to: "/category?cat=Smartwatches" },
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
  const [newest, setNewest] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 20),
      base44.entities.Product.filter({ status: "PUBLISHED" }, "-created_date", 100),
    ])
      .then(([top, latest]) => {
        setProducts(top);
        setNewest(latest);
      })
      .finally(() => setLoading(false));
  }, []);

  // Real product image per category — straight from the live crawled catalog.
  const categoryImage = useMemo(() => {
    const map = new Map();
    for (const p of [...newest, ...products]) {
      if (p.image_url && p.category && !map.has(p.category)) map.set(p.category, p.image_url);
    }
    return map;
  }, [newest, products]);

  // Landing hero: flagship phone first, then premium laptop.
  const hero =
    products.find((p) => p.category === "Smartphones") ||
    products.find((p) => p.category === "Laptops") ||
    products[0];
  const heroPlan = hero ? buildPlan(hero.customer_price) : null;

  // Recommended grid: phones & laptops first, then premium score.
  const trending = [...products].sort((a, b) => {
    const ra = PRIORITY_ORDER.indexOf(a.category);
    const rb = PRIORITY_ORDER.indexOf(b.category);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || (b.premium_score || 0) - (a.premium_score || 0);
  });

  return (
    <div>
      {/* International ribbon */}
      <div className="bg-noon-fg text-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-8 flex items-center justify-between text-[10px] md:text-[11px] font-semibold uppercase tracking-widest">
          <span className="truncate">VEYRO · International Premium Electronics</span>
          <span className="shrink-0">🌍</span>
          <span className="truncate hidden md:inline">{t("home.ribbonRight")}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 md:py-6 space-y-8 md:space-y-12">
        {/* Hero grid — noon-style deal cards, flagship-first */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid md:grid-cols-3 gap-3"
        >
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
                  className="mt-4 flex items-center gap-3 bg-white rounded-lg p-3 max-w-md hover:shadow-lg hover:-translate-y-0.5 transition duration-300"
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
            {/* Clickable flagship tiles — animated */}
            <div className="hidden sm:grid grid-cols-2 gap-2 md:gap-3 w-[180px] md:w-64 shrink-0 self-center">
              {HERO_TILES.map((tile, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.09, duration: 0.4 }}
                >
                  <Link
                    to={tile.to}
                    className="block rounded-lg overflow-hidden bg-white/60 ring-1 ring-black/5 hover:ring-accent-cyan hover:shadow-lg transition group no-tap-highlight"
                  >
                    {tile.optimized ? (
                      <Image
                        src={tile.src}
                        className="w-full aspect-square group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <img
                        src={tile.src}
                        alt="Premium electronics"
                        loading="lazy"
                        className="w-full aspect-square object-cover group-hover:scale-105 transition duration-500"
                      />
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Flagship card — iPhone hero, clickable & animated */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className="relative rounded-xl overflow-hidden min-h-[240px] md:min-h-[340px] bg-surface-secondary group"
          >
            <Link to="/category?cat=Smartphones" className="absolute inset-0" aria-label="Shop smartphones">
              <Image
                src={HERO_IPHONES}
                className="w-full h-full group-hover:scale-105 transition duration-700"
              />
            </Link>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
            <div className="absolute top-4 start-4 bg-noon text-noon-fg text-[10px] font-bold px-2.5 py-1 rounded uppercase pointer-events-none">
              {t("home.heroBadge")}
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 flex gap-2">
              <Link to="/category?cat=Smartphones" className="flex-1 text-center px-4 py-2.5 rounded-lg bg-white text-noon-fg text-xs md:text-sm font-semibold hover:bg-white/90 transition">
                {t("home.shopNow")}
              </Link>
              <Link to="/financing-info" className="flex-1 text-center px-4 py-2.5 rounded-lg bg-white text-noon-fg text-xs md:text-sm font-semibold hover:bg-white/90 transition">
                {t("nav.financing")}
              </Link>
            </div>
          </motion.div>
        </motion.section>

        {/* Latest Arrivals — freshest verified products from the crawler */}
        <NewArrivalsSection products={newest} />

        {/* Categories — real product imagery from the live catalog */}
        <section>
          <h2 className="font-display font-bold text-lg md:text-xl mb-4">{t("home.topCategories")}</h2>
          <div className="flex gap-3 md:gap-6 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((c) => {
              const realImg = categoryImage.get(c.name);
              return (
                <Link
                  key={c.name}
                  to={`/category?cat=${encodeURIComponent(c.name)}`}
                  className="flex flex-col items-center gap-2 shrink-0 no-tap-highlight group w-20 md:w-24"
                >
                  <span className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-white border border-border-hairline flex items-center justify-center group-hover:border-accent-cyan group-hover:shadow-md transition">
                    {realImg ? (
                      <Image src={realImg} className="w-full h-full group-hover:scale-110 transition duration-500" />
                    ) : c.fallback ? (
                      <img
                        src={c.fallback}
                        alt={c.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                      />
                    ) : (
                      <span className="text-2xl md:text-3xl">{c.icon}</span>
                    )}
                  </span>
                  <span className="text-xs text-text-muted group-hover:text-text-primary text-center leading-tight">{tCat(c.name)}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recommended — flagship phones & laptops first */}
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

        {/* Brands — major premium electronics brands */}
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