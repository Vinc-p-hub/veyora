// Live PRICING display config — fetched once from the server pricing engine
// (mode "display": plan structure only, never margins). Cards, product pages
// and checkout mirror the exact plan structure the server charges.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { DEFAULT_DISPLAY_CONFIG, buildPlanFromConfig, getPlanOptionsFromConfig } from "@/lib/pricing";

const PricingContext = createContext(null);

export function PricingProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_DISPLAY_CONFIG);

  useEffect(() => {
    let cancelled = false;
    api.functions
      .invoke("pricingEngine", { mode: "display" })
      .then((res) => {
        if (!cancelled && res.data?.config) setConfig({ ...DEFAULT_DISPLAY_CONFIG, ...res.data.config });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      config,
      plans: getPlanOptionsFromConfig(config),
      defaultPlanId: config.default_plan_id || "plan_5",
      buildPlan: (price, planId) => buildPlanFromConfig(price, planId || config.default_plan_id, config),
    }),
    [config]
  );

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within PricingProvider");
  return ctx;
}