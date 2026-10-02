// Live AUTOMATIC promotions for the storefront — loaded once and applied for
// display on cards, product pages, cart and checkout. Coupon codes are never
// loaded here: they are validated server-side only.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { bestPromoFor, freeShippingFor } from "@/lib/promotions";

const PromotionsContext = createContext(null);

export function PromotionsProvider({ children }) {
  const [promos, setPromos] = useState([]);

  useEffect(() => {
    base44.entities.Promotion.filter({ kind: "AUTOMATIC", active: true }, "-priority", 100)
      .then((rows) => setPromos(rows || []))
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      promos,
      promoFor: (product) => bestPromoFor(promos, product),
      freeShippingFor: (product, amountUsd) => freeShippingFor(promos, product, amountUsd),
    }),
    [promos]
  );

  return <PromotionsContext.Provider value={value}>{children}</PromotionsContext.Provider>;
}

export function usePromotions() {
  const ctx = useContext(PromotionsContext);
  if (!ctx) throw new Error("usePromotions must be used within PromotionsProvider");
  return ctx;
}