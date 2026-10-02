import React from "react";
import { Flame } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { usePromotions } from "@/lib/PromotionsContext";

// "Deals of the moment" — products covered by a live automatic promotion.
// Hidden entirely when no promotion is running.
export default function DealsSection({ products }) {
  const { promoFor } = usePromotions();
  const seen = new Set();
  const deals = products
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return !!promoFor(p);
    })
    .slice(0, 12);

  if (!deals.length) return null;

  return (
    <section>
      <h2 className="font-display font-bold text-lg md:text-xl mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-destructive" /> Deals of the moment
      </h2>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {deals.map((p) => (
          <div key={p.id} className="w-40 md:w-48 shrink-0">
            <ProductCard product={p} compact />
          </div>
        ))}
      </div>
    </section>
  );
}