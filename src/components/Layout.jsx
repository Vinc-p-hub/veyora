import React, { useState } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { Search, ShoppingBag, User, MapPin, Compass, LayoutGrid, Package, Shield } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { cn } from "@/lib/utils";

const CATS = ["Phones", "Computers", "Gaming", "Audio", "Cameras", "TV", "Smart Home", "Wearables", "Accessories"];
const NAV = [
  { to: "/", label: "Home", icon: Compass },
  { to: "/category", label: "Categories", icon: LayoutGrid },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/admin", label: "Admin", icon: Shield },
];

function CountryWidget() {
  const { country, countryCode, setCountryCode, countries } = useRegion();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition whitespace-nowrap"
      >
        <MapPin className="w-4 h-4" />
        <span className="hidden lg:inline">Deliver to</span>
        <span className="font-medium text-text-primary">{country.flag} <span className="hidden lg:inline">{country.name}</span></span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-3 w-56 bg-surface-card border border-border-hairline rounded-lg p-1.5 z-50 shadow-xl">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-text-muted">Country / Currency</div>
            {countries.map((c) => (
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
          </div>
        </>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-noon text-noon-fg mt-10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <span className="font-display font-extrabold text-xl">veyro</span>
          <p className="text-xs mt-3 opacity-80 leading-relaxed">
            Premium electronics with transparent installment pricing. The total price is always visible, upfront.
          </p>
          <div className="text-[11px] mt-3 font-medium">Stripe · Paystack · PayUnit · Crypto</div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Electronics</h4>
          <div className="space-y-2 text-xs opacity-80">
            {CATS.slice(0, 5).map((c) => (
              <Link key={c} to={`/category?cat=${encodeURIComponent(c)}`} className="block hover:underline">{c}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">More categories</h4>
          <div className="space-y-2 text-xs opacity-80">
            {CATS.slice(5).map((c) => (
              <Link key={c} to={`/category?cat=${encodeURIComponent(c)}`} className="block hover:underline">{c}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Customer care</h4>
          <div className="space-y-2 text-xs opacity-80">
            <Link to="/orders" className="block hover:underline">Your orders</Link>
            <Link to="/cart" className="block hover:underline">Cart</Link>
            <Link to="/admin" className="block hover:underline">Admin console</Link>
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
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const catParam = new URLSearchParams(location.search).get("cat");

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/category?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-border-hairline">
        {/* Main row: logo · search · account */}
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 md:gap-6 px-4 md:px-8 h-16">
          <Link to="/" className="shrink-0">
            <span className="bg-noon text-noon-fg font-display font-extrabold text-lg md:text-xl px-3 py-1 rounded-md inline-block leading-none">veyro</span>
          </Link>
          <form onSubmit={submitSearch} className="flex-1 max-w-3xl flex min-w-0">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What are you looking for?"
              className="flex-1 min-w-0 bg-white border border-border-hairline border-r-0 rounded-l-lg px-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none"
            />
            <button type="submit" aria-label="Search" className="bg-noon px-4 md:px-6 rounded-r-lg flex items-center justify-center hover:bg-yellow-200 transition">
              <Search className="w-5 h-5 text-noon-fg" />
            </button>
          </form>
          <div className="hidden md:block shrink-0"><CountryWidget /></div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Link to="/orders" className="p-2 rounded-lg hover:bg-surface-secondary text-text-muted hover:text-text-primary transition"><User className="w-5 h-5" /></Link>
            <Link to="/cart" className="relative p-2 rounded-lg hover:bg-surface-secondary text-text-primary transition">
              <ShoppingBag className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-noon text-noon-fg text-[10px] font-bold flex items-center justify-center">{count}</span>
              )}
            </Link>
            <div className="md:hidden"><CountryWidget /></div>
          </div>
        </div>
        {/* Category strip */}
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex items-center gap-5 md:gap-6 h-11 overflow-x-auto scrollbar-hide text-[13px]">
          <Link
            to="/category"
            className={cn(
              "whitespace-nowrap py-2.5 border-b-2 -mb-px",
              !catParam && location.pathname === "/category" ? "border-noon-fg font-semibold text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            All products
          </Link>
          {CATS.map((c) => (
            <Link
              key={c}
              to={`/category?cat=${encodeURIComponent(c)}`}
              className={cn(
                "whitespace-nowrap py-2.5 border-b-2 -mb-px",
                catParam === c ? "border-noon-fg font-semibold text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
              )}
            >
              {c}
            </Link>
          ))}
          <Link
            to="/admin"
            className={cn(
              "whitespace-nowrap py-2.5 border-b-2 -mb-px ml-auto",
              location.pathname === "/admin" ? "border-noon-fg font-semibold text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      <Footer />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border-hairline flex items-center justify-around h-16 px-2">
        {NAV.map((item) => {
          const active = location.pathname === item.to || (item.to === "/category" && location.pathname.startsWith("/category"));
          return (
            <Link
              key={item.to}
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