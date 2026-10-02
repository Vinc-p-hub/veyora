import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  COUNTRIES, CURRENCIES, registerCountry, registerCurrency, getCurrency,
} from "@/lib/countries";

const RegionContext = createContext(null);
const STORAGE_KEY = "veyro_region_v1";

export function RegionProvider({ children }) {
  const [countryCode, setCountryCode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "US";
  });
  const [blockedCodes, setBlockedCodes] = useState(() => new Set());
  const [overridesVersion, setOverridesVersion] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, countryCode);
  }, [countryCode]);

  // Merge Super-Admin-managed countries & currencies (data) into the default
  // registry — adding a new market never requires a code change. Countries the
  // Super Admin has deactivated (Market control) are collected separately and
  // removed from the storefront entirely.
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
      const blocked = new Set();
      countries.forEach((c) => {
        const code = String(c.code || "").toUpperCase();
        if (!code) return;
        if (c.enabled === false) {
          blocked.add(code);
          return;
        }
        registerCountry({
          code: c.code,
          name: c.name,
          currency: c.currency,
          flag: c.flag,
          shipping: c.shipping,
          taxRate: c.tax_rate,
          providers: c.providers,
        });
      });
      setBlockedCodes(blocked);
      setOverridesVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Markets VEYRO actually sells to — the full registry minus every blocked
  // country. Only these can ever be selected for delivery.
  const markets = COUNTRIES.filter((c) => !blockedCodes.has(c.code));
  const country = markets.find((c) => c.code === countryCode) || markets[0] || COUNTRIES[0];
  const currency = getCurrency(country.currency);

  // A blocked country can never stay selected in the storefront.
  useEffect(() => {
    if (country.code !== countryCode) setCountryCode(country.code);
  }, [country.code, countryCode]);

  return (
    <RegionContext.Provider
      key={overridesVersion}
      value={{
        countryCode,
        setCountryCode,
        country,
        currency,
        countries: markets,
        allCountries: COUNTRIES,
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