import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, ShieldCheck, Truck, RefreshCw, Check, ChevronRight, Heart, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { useCart } from "@/lib/CartContext";
import { useLang } from "@/lib/i18n";
import { formatPrice } from "@/lib/pricing";
import { usePricing } from "@/lib/PricingContext";
import { useSiteText } from "@/lib/useSiteText";
import { applySeo } from "@/lib/seo";
import ProductOffers from "@/components/ProductOffers";
import CustomerReviews from "@/components/reviews/CustomerReviews";
import SourceReviews from "@/components/reviews/SourceReviews";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { currency, country } = useRegion();
  const { addItem } = useCart();
  const { plans, buildPlan } = usePricing();
  const { t } = useLang();
  const getText = useSiteText();
  const [product, setProduct] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState("plan_5");
  const [added, setAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    setLoading(true);
    base44.entities.Product.filter({ slug, status: "PUBLISHED" }, null, 1)
      .then((res) => setProduct(res[0] || null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!product?.id) return;
    base44.entities.WishlistItem.filter({ product_id: product.id })
      .then((items) => setWishlisted(items.length > 0))
      .catch(() => {});
    // Real seller offers for this canonical product — multi-seller comparison.
    base44.entities.Offer.filter({ product_id: product.id })
      .then((rows) => setOffers(rows.filter((o) => !o.stale && o.stock_status !== "OUT_OF_STOCK")))
      .catch(() => {});
  }, [product?.id]);

  // SEO: unique title, meta description, canonical URL and Product structured
  // data. The structured data carries ONLY what is real on the page — price,
  // availability, brand, identifiers, and ratings exclusively when real
  // published reviews exist. Nothing is invented.
  useEffect(() => {
    if (!product) return;
    const availabilityMap = {
      IN_STOCK: "https://schema.org/InStock",
      LOW_STOCK: "https://schema.org/LimitedAvailability",
      OUT_OF_STOCK: "https://schema.org/OutOfStock",
      PREORDER: "https://schema.org/PreOrder",
    };
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: [product.image_url, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean).slice(0, 8),
      description: product.description || undefined,
      sku: product.sku || undefined,
      gtin13: product.gtin && product.gtin.length === 13 ? product.gtin : undefined,
      mpn: product.mpn || undefined,
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      ...(Number(product.reviews_count) > 0 && product.rating ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: product.rating,
          reviewCount: product.reviews_count,
        },
      } : {}),
      offers: {
        "@type": "Offer",
        url: `${window.location.origin}/product/${product.slug}`,
        price: product.customer_price,
        priceCurrency: product.currency || "USD",
        itemCondition: "https://schema.org/NewCondition",
        ...(availabilityMap[product.stock_status] ? { availability: availabilityMap[product.stock_status] } : {}),
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 30,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/FreeReturn",
        },
      },
    };
    applySeo({
      title: `${product.seo_title || `${product.brand} ${product.name}`} | VEYRO`,
      description: product.meta_description ||
        `Buy ${product.name}${product.brand ? ` by ${product.brand}` : ""} on VEYRO — transparent pricing, verified sellers and flexible installment plans.`,
      path: `/product/${product.slug}`,
      jsonLd,
    });
  }, [product, country.code]);

  if (loading) {
    return <div className="p-10 max-w-[1400px] mx-auto"><div className="aspect-[3/4] bg-surface-card rounded-lg animate-pulse max-w-md" /></div>;
  }
  if (!product) {
    return <div className="p-10 text-center text-text-muted">Product not found. <Link to="/category" className="text-accent-cyan">Browse catalog</Link></div>;
  }

  // Crawled specs can carry nested objects/arrays (e.g. Shopify variants) —
  // flatten them to a display string so React never gets an object as a child.
  const specText = (v) => {
    if (v === null || v === undefined) return "—";
    if (typeof v !== "object") return String(v);
    if (Array.isArray(v)) return v.map(specText).join(", ");
    return Object.entries(v).map(([k, x]) => `${k}: ${specText(x)}`).join(" · ");
  };

  // REAL GALLERY ONLY — main image + the real crawled gallery, deduplicated.
  // The image is never duplicated artificially to fill the thumbnails.
  const gallery = [...new Set([product.image_url, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean))];
  const videos = Array.isArray(product.videos) ? product.videos.filter(Boolean) : [];
  const mainImage = activeImage && gallery.includes(activeImage) ? activeImage : gallery[0] || product.image_url;
  const veyroFreeUnits = Math.max(0, (Number(product.veyro_stock) || 0) - (Number(product.reserved_stock) || 0));

  const price = product.customer_price;
  const plan = buildPlan(price, planId);
  const bestSellerName = offers[0]?.seller_name || product.source_name;
  const multipleSellers = offers.length > 1;
  const todayFmt = formatPrice(plan.first_payment, currency);
  const monthlyFmt = formatPrice(plan.next_amount, currency);
  const totalFmt = formatPrice(plan.total, currency);
  const shipping = formatPrice(country.shipping || 15, currency);
  const tax = Math.round(price * country.taxRate * 100) / 100;

  const handleAdd = () => {
    addItem({ ...product, seller_name: bestSellerName }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const toggleWishlist = async () => {
    const items = await base44.entities.WishlistItem.filter({ product_id: product.id });
    if (items.length) {
      await base44.entities.WishlistItem.delete(items[0].id);
      setWishlisted(false);
    } else {
      await base44.entities.WishlistItem.create({
        product_id: product.id,
        product_slug: product.slug,
        price_at_add: price,
      });
      setWishlisted(true);
    }
  };

  const buyNow = () => {
    addItem({ ...product, seller_name: bestSellerName }, 1);
    navigate(`/checkout?plan=${planId}`);
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-6">
        <Link to="/" className="hover:text-text-primary">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/category?cat=${product.category}`} className="hover:text-text-primary">{product.category}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-text-primary truncate">{product.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-card border border-border-hairline">
            {activeVideo ? (
              <video src={activeVideo} controls autoPlay playsInline className="w-full h-full object-cover bg-black" />
            ) : (
              <img src={mainImage} alt={`${product.name} — ${gallery.indexOf(mainImage) + 1}`} className="w-full h-full object-cover" />
            )}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-primary/80 backdrop-blur border border-badge-premium/30 text-xs text-mono text-badge-premium">
              <ShieldCheck className="w-3.5 h-3.5" /> Premium {product.premium_score}%
            </div>
          </div>
          {(gallery.length > 1 || videos.length > 0) && (
            <div className="grid grid-cols-4 gap-2">
              {gallery.map((img, i) => (
                <button
                  key={img}
                  onClick={() => { setActiveImage(img); setActiveVideo(null); }}
                  className={cn(
                    "aspect-square rounded-lg overflow-hidden bg-surface-card border transition",
                    !activeVideo && mainImage === img ? "border-accent-cyan opacity-100" : "border-border-hairline opacity-70 hover:opacity-100"
                  )}
                >
                  <img src={img} alt={`${product.name} — view ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {videos.map((v, i) => (
                <button
                  key={v}
                  onClick={() => setActiveVideo(v)}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden bg-surface-card border transition",
                    activeVideo === v ? "border-accent-cyan opacity-100" : "border-border-hairline opacity-70 hover:opacity-100"
                  )}
                >
                  <video src={v} preload="metadata" muted className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-text-muted">{product.brand}</div>
            <h1 className="font-display font-bold text-2xl md:text-4xl mt-1.5 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-3 mt-3 text-sm text-text-muted">
              <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-badge-premium text-badge-premium" /> {product.rating}</span>
              <span>· {product.reviews_count} reviews</span>
              <span>· Match {Math.round(product.match_confidence * 100)}%</span>
            </div>
          </div>

          <p className="text-sm text-text-muted leading-relaxed">{product.description}</p>

          {/* Price + installment panel */}
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted">Total price</div>
              <div className="font-display font-bold text-3xl md:text-4xl mt-1">{formatPrice(price, currency)}</div>
            </div>

            {/* Plan selector */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Payment plan</div>
              <div className="grid grid-cols-2 gap-2">
                {plans.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPlanId(opt.id)}
                    className={cn(
                      "px-3 py-2.5 rounded-lg border text-sm transition text-left",
                      planId === opt.id ? "border-accent-cyan bg-accent-cyan/5 text-text-primary" : "border-border-hairline text-text-muted hover:text-text-primary"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            <div className="rounded-lg bg-surface-primary p-4 space-y-2.5">
              {plan.count === 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{t("detail.payToday", { p: totalFmt })}</span>
                  <span className="text-mono font-semibold text-accent-cyan">{totalFmt}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{t("detail.payToday", { p: todayFmt })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{t("detail.thenPayments", { n: plan.count, p: monthlyFmt })}</span>
                    <span className="text-mono font-semibold">{monthlyFmt} / mo</span>
                  </div>
                  <div className="border-t border-border-hairline pt-2.5 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-text-muted">{t("detail.total", { p: totalFmt })}</span>
                    <span className="text-mono font-bold">{totalFmt}</span>
                  </div>
                </>
              )}
              <p className="text-[11px] text-text-muted leading-relaxed pt-1">
                {t("detail.noHidden")}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                onClick={buyNow}
                className="flex-1 py-3.5 rounded-lg bg-noon text-noon-fg font-semibold text-sm hover:opacity-90 transition"
              >
                {plan.count === 0 ? `Buy now · ${todayFmt}` : `Prequalify · ${todayFmt} today`}
              </button>
              <button
                onClick={handleAdd}
                className={cn(
                  "px-5 py-3.5 rounded-lg border text-sm font-medium transition flex items-center gap-2",
                  added ? "border-emerald-400 text-emerald-400" : "border-border-hairline hover:border-accent-cyan/40"
                )}
              >
                {added ? <><Check className="w-4 h-4" /> Added</> : "Add to cart"}
              </button>
              <button
                onClick={toggleWishlist}
                aria-label="Wishlist"
                title="Wishlist"
                className={cn(
                  "px-4 py-3.5 rounded-lg border transition",
                  wishlisted ? "border-red-400 text-red-500" : "border-border-hairline hover:border-accent-cyan/40 text-text-muted"
                )}
              >
                <Heart className={cn("w-5 h-5", wishlisted && "fill-red-500 text-red-500")} />
              </button>
            </div>
          </div>

          {/* Trust row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border-hairline">
              <Truck className="w-5 h-5 text-accent-cyan" />
              <div className="text-xs">{product.delivery_days} day delivery</div>
              <div className="text-[10px] text-text-muted">{shipping} shipping</div>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border-hairline">
              <ShieldCheck className="w-5 h-5 text-accent-cyan" />
              <div className="text-xs">2-year warranty</div>
              <div className="text-[10px] text-text-muted">VEYRO verified</div>
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg border border-border-hairline">
              <RefreshCw className="w-5 h-5 text-accent-cyan" />
              <div className="text-xs">30-day returns</div>
              <div className="text-[10px] text-text-muted">No questions</div>
            </div>
          </div>

          {/* Specs */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-3">Specifications</h3>
            <div className="rounded-lg border border-border-hairline overflow-hidden">
              {Object.entries(product.specifications || {}).map(([k, v], i) => (
                <div key={k} className={cn("flex justify-between px-4 py-3 text-sm", i % 2 === 0 ? "bg-surface-card" : "bg-surface-secondary")}>
                  <span className="text-text-muted">{k}</span>
                  <span className="text-mono">{specText(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Seller & marketplace transparency */}
          <div className="rounded-lg bg-surface-card border border-border-hairline p-4 space-y-2">
            <div className="text-xs">
              Sold and shipped by <span className="text-text-primary font-semibold">{bestSellerName}</span>
              {multipleSellers && <span className="text-accent-cyan font-semibold"> · Multiple sellers available</span>}
            </div>
            <p className="text-[11px] text-text-muted leading-snug">
              {getText("marketplace_notice", "VEYRO Marketplace — you are buying via VEYRO from an identified partner seller.")}
            </p>
            <div className="text-xs text-text-muted pt-1">
              Stock status: <span className="text-text-primary">{product.stock_status.replace(/_/g, " ").toLowerCase()}</span>.
            </div>
            {veyroFreeUnits > 0 && (
              <div className="text-xs text-accent-cyan pt-0.5">
                In VEYRO stock — {veyroFreeUnits} unit{veyroFreeUnits > 1 ? "s" : ""} ship directly from VEYRO.
              </div>
            )}
          </div>
          {multipleSellers && <ProductOffers product={product} offers={offers} />}
        </div>
      </div>

      {/* Reviews — customer reviews (verified buyers) and imported source
          reviews are displayed in two fully separate sections */}
      <div className="mt-10 space-y-6">
        <CustomerReviews product={product} />
        <SourceReviews product={product} />
      </div>
    </div>
  );
}