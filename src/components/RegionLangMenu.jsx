import React, { useMemo, useState } from "react";
import { Globe, ChevronDown, MapPin } from "lucide-react";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Combined delivery-country + language selector in one compact dropdown —
// a single control instead of two separate widgets, keeping the header
// clean and uncluttered, especially on small screens.
export default function RegionLangMenu() {
  const { country, countryCode, setCountryCode, countries } = useRegion();
  const { lang, setLang, languages, t } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const activeLang = languages.find((l) => l.code === lang);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));
  }, [countries, q]);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => { setOpen((o) => !o); setQ(""); }}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 hover:bg-black/10 transition no-tap-highlight"
        title={`${t("header.deliverTo")} · ${t("header.language")}`}
      >
        <span className="text-sm leading-none">{country.flag}</span>
        <span className="hidden sm:inline text-xs font-semibold">{country.code}</span>
        <Globe className="w-4 h-4 hidden sm:block" />
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-2 w-[280px] bg-surface-card text-text-primary border border-border-hairline rounded-lg p-1.5 z-50 shadow-xl">
            {/* Language */}
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> {t("header.language")}
            </div>
            <div className="flex flex-wrap gap-1 px-1 pb-1">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-medium border transition",
                    l.code === lang ? "bg-noon text-noon-fg border-noon" : "bg-surface-primary border-border-hairline hover:border-accent-cyan/40"
                  )}
                >
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
            <div className="border-t border-border-hairline my-1" />
            {/* Delivery country */}
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {t("header.deliverTo")}
            </div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a country…"
              className="w-full mb-1 bg-surface-primary border border-border-hairline rounded-md px-2.5 py-2 text-xs outline-none focus:border-accent-cyan/50"
            />
            <div className="max-h-56 overflow-auto">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  onClick={() => { setCountryCode(c.code); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-2 rounded-md text-xs hover:bg-surface-secondary transition",
                    c.code === countryCode && "bg-surface-secondary font-semibold"
                  )}
                >
                  <span className="flex items-center gap-2"><span>{c.flag}</span>{c.name}</span>
                  <span className="text-text-muted">{c.currency}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-2 py-3 text-xs text-text-muted">No country found.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}