import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/lib/CartContext";
import UpsellCard from "@/components/cart/UpsellCard";

// What customers actually pair a device with — used to build the bundle row
// from the live catalog, never from invented recommendations.
const COMPLEMENTS = {
  Smartphones: ["Accessories", "Audio", "Headphones & Earbuds", "Smartwatches"],
  Laptops: ["Accessories", "Computer Components", "Audio", "TVs & Monitors"],
  Tablets: ["Accessories", "Audio", "Headphones & Earbuds"],
  Gaming: ["Accessories", "Audio", "Computer Components"],
  Cameras: ["Accessories", "Computer Components"],
  "TVs & Monitors": ["Audio", "Gaming", "Accessories"],
};
const DEFAULT_COMPLEMENTS = ["Accessories", "Audio", "Headphones & Earbuds", "Computer Components"];

function Row({ title, subtitle, products }) {
  if (!products.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="font-display font-semibold text-base md:text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {products.map((p) => <UpsellCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export default function CartUpsell() {
  const { items } = useCart();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    base44.entities.Product.filter({ status: "PUBLISHED" }, "-premium_score", 80)
      .then(setProducts)
      .catch(() => {});
  }, []);

  const { bundle, similar } = useMemo(() => {
    const inCart = new Set(items.map((i) => i.id));
    const pool = products.filter((p) => p.image_url && !inCart.has(p.id));
    // The order's anchor product drives the recommendations.
    const anchor = [...items].sort(
      (a, b) => (b.customer_price || 0) * b.qty - (a.customer_price || 0) * a.qty
    )[0];
    const complementCats = new Set(COMPLEMENTS[anchor?.category] || DEFAULT_COMPLEMENTS);
    const bundleList = pool.filter((p) => complementCats.has(p.category)).slice(0, 8);
    const taken = new Set(bundleList.map((p) => p.id));
    const similarList = pool
      .filter((p) => p.category === anchor?.category && !taken.has(p.id))
      .slice(0, 8);
    return { bundle: bundleList, similar: similarList };
  }, [products, items]);

  return (
    <>
      <Row
        title="Complete your setup"
        subtitle="What customers usually add to this order"
        products={bundle}
      />
      <Row
        title="Frequently bought together"
        subtitle="More options in the same category"
        products={similar}
      />
    </>
  );
}