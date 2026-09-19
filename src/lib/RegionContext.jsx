import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  COUNTRIES, CURRENCIES, registerCountry, registerCurrency, getCountry, getCurrency,
} from "@/lib/countries";

const RegionContext = createContext(null);
const STORAGE_KEY = "veyro_region_v1";

export function RegionProvider({ children }) {
  const [countryCode, setCountryCode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "US";
  });
  const [overridesVersion, setOverridesVersion] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, countryCode);
  }, [countryCode]);

  // Merge Super-Admin-managed countries & currencies (data) into the default
  // registry — adding a new market never requires a code change.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      base44.entities.CurrencyRate.list(null, 300).catch(() => []),
      base44.entities.CountryConfig.list(null, 300).catch(() => []),
    ]).then(([rates, countries]) => {
      if (cancelled) return;
      rates.forEach((r) => {
        if (r.code && typeof r.rate === "number") {
          registerCurrency(r.code, { code: r.code, symbol: r.symbol, rate: r.rate });
        }
      });
      countries
        .filter((c) => c.enabled !== false)
        .forEach((c) =>
          registerCountry({
            code: c.code,
            name: c.name,
            currency: c.currency,
            flag: c.flag,
            shipping: c.shipping,
            taxRate: c.tax_rate,
            providers: c.providers,
          })
        );
      setOverridesVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const country = getCountry(countryCode);
  const currency = getCurrency(country.currency);

  return (
    <RegionContext.Provider
      key={overridesVersion}
      value={{
        countryCode,
        setCountryCode,
        country,
        currency,
        countries: COUNTRIES,
        currencies: CURRENCIES,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}