import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice, buildInstallmentPlan } from "@/lib/pricing";
import ProductCard from "@/components/ProductCard";

const CATEGORIES = [
  { name: "Phones", icon: "📱", count: "2.4k" },
  { name: "Computers", icon: "💻", count: "1.8k" },
  { name: "Gaming", icon: "🎮", count: "960" },
  { name: "Audio", icon: "🎧", count: "3.1k" },
  { name: "Cameras", icon: "📷", count: "540" },
  { name: "TV", icon: "📺", count: "720" },
  { name: "Smart Home", icon: "🏠", count: "1.2k" },
  { name: "Wearables", icon: "⌚", count: "680" },
  { name: "Accessories", icon: "🔌", count: "4.5k" },
];

const BRANDS = ["Apple", "Sony", "Bose", "Leica", "Bang & Olufsen", "Samsung", "Canon", "Nikon", "ASUS", "Dyson", "Sennheiser", "LG"];

export default function Home() {
  const { currency } = useRegion();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 20)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const hero = products.find((p) => p.slug === "sony-wh-1000xm6-veyro-edition") || products[0];
  const heroPlan = hero ? buildInstallmentPlan(hero.customer_price, 5, 0.15) : null;
  const trending = products.slice(0, 8);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 space-y-12 md:space-y-16 max-w-[1400px] mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border-hairline bg-surface-secondary min-h-[560px] md:min-h-[640px] flex flex-col">
        <div className="absolute inset-0 radial-cyan" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-primary via-transparent to-transparent" />
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-14 py-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/5 text-xs text-mono text-accent-cyan w-fit mb-6">
            <Zap className="w-3.5 h-3.5" /> ULTRA-PERFORMANCE TECH
          </div>
          <h1 className="text-display text-[clamp(2.5rem,5vw,4.5rem)]">
            VEYRO<br />
            <span className="text-text-muted">PREMIUM</span><span className="text-accent-cyan">.</span>
          </h1>
          <p className="text-text-muted mt-5 max-w-md text-sm md:text-base leading-relaxed">
            Discover ultra-performance electronics from authorized sources worldwide. Pay in full or split into flexible installments — the total is always clear.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link to="/category" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent-cyan text-surface-primary font-medium text-sm hover:opacity-90 transition">
              Explore Premium Tech <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/category?sort=trending" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border-hairline text-sm hover:border-accent-cyan/40 transition">
              <TrendingUp className="w-4 h-4" /> Trending now
            </Link>
          </div>
        </div>

        {/* Hero product card */}
        {hero && heroPlan && (
          <div className="relative z-10 px-6 md:px-14 pb-8">
            <Link to={`/product/${hero.slug}`} className="block md:flex items-end gap-6 bg-surface-card/80 backdrop-blur border border-border-hairline rounded-2xl p-4 md:p-5 max-w-md hover:border-accent-cyan/40 transition">
              <div className="w-full md:w-28 h-28 rounded-xl overflow-hidden bg-surface-secondary shrink-0 mb-3 md:mb-0">
                <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-text-muted">{hero.brand}</div>
                <div className="font-medium text-sm leading-snug mt-0.5">{hero.name}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface-primary py-2">
                    <div className="text-[9px] uppercase text-text-muted">Today</div>
                    <div className="text-mono text-accent-cyan font-semibold text-sm">{formatPrice(heroPlan.downPayment, currency)}</div>
                  </div>
                  <div className="rounded-lg bg-surface-primary py-2">
                    <div className="text-[9px] uppercase text-text-muted">Monthly ×{heroPlan.installmentCount}</div>
                    <div className="text-mono font-semibold text-sm">{formatPrice(heroPlan.installmentAmount, currency)}</div>
                  </div>
                  <div className="rounded-lg bg-surface-primary py-2">
                    <div className="text-[9px] uppercase text-text-muted">Total</div>
                    <div className="text-mono font-semibold text-sm">{formatPrice(heroPlan.totalPaid, currency)}</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* Categories rail */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl md:text-2xl">Curated Categories</h2>
          <Link to="/category" className="text-xs text-text-muted hover:text-accent-cyan flex items-center gap-1">All <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-9 gap-2.5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.name}
              to={`/category?cat=${encodeURIComponent(c.name)}`}
              className="group flex flex-col items-center justify-center aspect-square bg-surface-card border border-border-hairline rounded-2xl hover:border-accent-cyan/40 transition no-tap-highlight"
            >
              <span className="text-2xl md:text-3xl mb-1.5">{c.icon}</span>
              <span className="text-xs font-medium">{c.name}</span>
              <span className="text-[10px] text-mono text-text-muted">{c.count}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending / crawler spotlights */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-xl md:text-2xl">Crawler Live Spotlights</h2>
            <p className="text-xs text-text-muted mt-1">Verified premium · 95%+ match confidence · live pricing</p>
          </div>
          <Link to="/category?sort=trending" className="text-xs text-text-muted hover:text-accent-cyan flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-surface-card rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {trending.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Brand whitelist grid */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-5 h-5 text-badge-premium" />
          <h2 className="font-display font-bold text-xl md:text-2xl">Premium Brand Whitelist</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {BRANDS.map((b) => (
            <Link
              key={b}
              to={`/category?brand=${encodeURIComponent(b)}`}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-card border border-border-hairline hover:border-accent-cyan/40 transition"
            >
              <span className="font-display font-semibold text-sm">{b}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-accent-cyan transition" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}