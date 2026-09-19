import React, { useMemo, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { ShoppingBag, User, MapPin, Compass, LayoutGrid, Package, Search as SearchIcon, Heart, Globe, ChevronDown } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import SearchBar from "@/components/SearchBar";
import { useRegion } from "@/lib/RegionContext";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Public marketplace navigation — the Super Admin console (/admin) is
// intentionally absent from every menu, header and footer here.
const CATS = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
];

function CountryWidget() {
  const { country, countryCode, setCountryCode, countries } = useRegion();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));
  }, [countries, q]);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => { setOpen((o) => !o); setQ(""); }}
        className="flex items-center gap-1 text-xs hover:opacity-70 transition max-w-[140px]"
        title={t("header.deliverTo")}
      >
        <MapPin className="w-4 h-4 shrink-0" />
        <span className="truncate font-medium">
          {country.flag} <span className="hidden lg:inline">{country.name}</span><span className="lg:hidden">{country.code}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute start-0 mt-3 w-72 bg-white border border-border-hairline rounded-lg p-1.5 z-50 shadow-xl">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-text-muted">{t("header.deliverTo")}</div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a country…"
              className="w-full mb-1 bg-surface-primary border border-border-hairline rounded-md px-2.5 py-2 text-xs outline-none focus:border-accent-cyan/50"
            />
            <div className="max-h-72 overflow-auto">
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

function LanguageWidget() {
  const { lang, setLang, languages } = useLang();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const active = languages.find((l) => l.code === lang);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs hover:opacity-70 transition whitespace-nowrap"
        title={t("header.language")}
      >
        <Globe className="w-4 h-4" />
        <span className="font-medium">{active?.label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 mt-3 w-40 bg-white border border-border-hairline rounded-lg p-1.5 z-50 shadow-xl">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-text-muted">{t("header.language")}</div>
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs hover:bg-surface-secondary transition",
                  l.code === lang && "bg-surface-secondary font-semibold"
                )}
              >
                <span>{l.flag}</span>{l.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HeaderAction({ to, icon: Icon, label, onClick, badge }) {
  return (
    <Link to={to} onClick={onClick} className="relative flex flex-col items-center gap-0.5 hover:opacity-60 transition no-tap-highlight">
      <Icon className="w-5 h-5" />
      <span className="hidden md:block text-[10px] font-medium leading-none">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 -end-1.5 min-w-[16px] h-4 px-1 rounded-full bg-noon-fg text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>
      )}
    </Link>
  );
}

function Footer() {
  const { t, tCat } = useLang();
  return (
    <footer className="bg-noon text-noon-fg mt-10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <span className="font-display font-extrabold text-xl">veyro</span>
          <p className="text-xs mt-3 opacity-80 leading-relaxed">{t("footer.tagline")}</p>
          <div className="text-[11px] mt-3 font-medium">Stripe · Flutterwave · Paystack · M-Pesa · Alipay · Crypto</div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">{t("footer.electronics")}</h4>
          <div className="space-y-2 text-xs opacity-80">
            {CATS.slice(0, 7).map((c) => (
              <Link key={c} to={`/category?cat=${encodeURIComponent(c)}`} className="block hover:underline">{tCat(c)}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">{t("footer.moreCategories")}</h4>
          <div className="space-y-2 text-xs opacity-80">
            {CATS.slice(7).map((c) => (
              <Link key={c} to={`/category?cat=${encodeURIComponent(c)}`} className="block hover:underline">{tCat(c)}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">{t("footer.customerCare")}</h4>
          <div className="space-y-2 text-xs opacity-80">
            <Link to="/orders" className="block hover:underline">{t("footer.yourOrders")}</Link>
            <Link to="/cart" className="block hover:underline">{t("footer.cart")}</Link>
            <Link to="/wishlist" className="block hover:underline">{t("nav.wishlist")}</Link>
            <Link to="/financing-info" className="block hover:underline">{t("footer.financing")}</Link>
            <Link to="/support" className="block hover:underline">{t("footer.help")}</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-black/10 py-4 text-center text-[11px] font-medium">
        © 2026 VEYRO — Premium electronics, paid your way.
      </div>
    </footer>
  );
}

export default function Layout() {
  const { count } = useCart();
  const { t, tCat } = useLang();
  const location = useLocation();
  const catParam = new URLSearchParams(location.search).get("cat");

  const NAV = [
    { to: "/", label: t("nav.home"), icon: Compass },
    { to: "/category", label: t("nav.search"), icon: SearchIcon, search: true },
    { to: "/category", label: t("nav.categories"), icon: LayoutGrid },
    { to: "/orders", label: t("nav.orders"), icon: Package },
    { to: "/profile", label: t("nav.account"), icon: User },
  ];

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary flex flex-col">
      {/* Noon-style yellow header */}
      <header className="sticky top-0 z-30 bg-noon text-noon-fg shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 md:px-8">
          <div className="flex items-center gap-3 md:gap-6 h-14 md:h-[68px]">
            <Link to="/" className="shrink-0" aria-label="VEYRO">
              <span className="font-display font-extrabold text-2xl md:text-[28px] leading-none tracking-tight">veyro</span>
            </Link>
            <CountryWidget />
            <SearchBar />
            <div className="hidden md:flex items-center gap-5 shrink-0">
              <LanguageWidget />
              <HeaderAction to="/profile" icon={User} label={t("nav.account")} />
              <HeaderAction to="/orders" icon={Package} label={t("nav.orders")} />
              <HeaderAction to="/wishlist" icon={Heart} label={t("nav.wishlist")} />
              <HeaderAction to="/cart" icon={ShoppingBag} label={t("footer.cart")} badge={count} />
            </div>
            <div className="md:hidden flex items-center gap-3 shrink-0 ms-auto">
              <LanguageWidget />
              <HeaderAction to="/cart" icon={ShoppingBag} label="" badge={count} />
            </div>
          </div>
        </div>
        {/* Category strip */}
        <div className="bg-white border-b border-border-hairline text-noon-fg">
          <div className="max-w-[1400px] mx-auto px-3 md:px-8 flex items-center gap-4 md:gap-6 h-11 overflow-x-auto scrollbar-hide text-[13px]">
            <Link
              to="/category"
              className={cn(
                "whitespace-nowrap py-2.5 border-b-2 -mb-px",
                !catParam && location.pathname === "/category" ? "border-noon-fg font-semibold" : "border-transparent text-text-muted hover:text-text-primary"
              )}
            >
              {t("header.allProducts")}
            </Link>
            {CATS.map((c) => (
              <Link
                key={c}
                to={`/category?cat=${encodeURIComponent(c)}`}
                className={cn(
                  "whitespace-nowrap py-2.5 border-b-2 -mb-px",
                  catParam === c ? "border-noon-fg font-semibold" : "border-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {tCat(c)}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      <Footer />

      {/* Mobile bottom nav: Home / Search / Categories / Orders / Account */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border-hairline flex items-center justify-around h-16 px-2">
        {NAV.map((item, idx) => {
          const active =
            idx === 0 ? location.pathname === "/" :
            item.search ? location.pathname === "/category" && !catParam :
            item.to === "/category" ? location.pathname === "/category" && !!catParam :
            location.pathname === item.to;
          return (
            <Link
              key={idx}
              to={item.to}
              className={cn("flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg no-tap-highlight", active ? "bg-noon text-noon-fg" : "text-text-muted")}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}