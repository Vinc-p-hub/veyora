import React, { createContext, useContext, useState, useEffect } from "react";
import { COUNTRIES, CURRENCIES, getCountry, getCurrency } from "@/lib/countries";

const RegionContext = createContext(null);
const STORAGE_KEY = "veyro_region_v1";

export function RegionProvider({ children }) {
  const [countryCode, setCountryCode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || "US";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, countryCode);
  }, [countryCode]);

  const country = getCountry(countryCode);
  const currency = getCurrency(country.currency);

  return (
    <RegionContext.Provider value={{ countryCode, setCountryCode, country, currency, countries: COUNTRIES, currencies: CURRENCIES }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}