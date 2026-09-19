import React, { useState } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { Search, ShoppingBag, Heart, User, Compass, LayoutGrid, Package, Shield, Globe } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Discover", icon: Compass },
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-hairline hover:border-accent-cyan/40 transition text-xs text-mono text-text-muted hover:text-text-primary"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{country.flag}</span>
        <span className="text-text-primary">{country.currency}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-surface-card border border-border-hairline rounded-xl p-1.5 z-50 shadow-2xl">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-text-muted">Country / Currency</div>
            {countries.map((c) => (
              <button
                key={c.code}
                onClick={() => { setCountryCode(c.code); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-2 rounded-lg text-xs hover:bg-surface-secondary transition",
                  c.code === countryCode && "bg-surface-secondary text-accent-cyan"
                )}
              >
                <span className="flex items-center gap-2"><span>{c.flag}</span>{c.name}</span>
                <span className="text-mono text-text-muted">{c.currency}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/category?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary flex">
      {/* Desktop slim rail */}
      <aside className="hidden md:flex flex-col w-[68px] lg:w-[220px] shrink-0 border-r border-border-hairline bg-surface-secondary sticky top-0 h-screen flex-col">
        <Link to="/" className="flex items-center gap-2.5 px-4 lg:px-6 h-16 border-b border-border-hairline">
          <div className="w-8 h-8 rounded-lg bg-accent-cyan flex items-center justify-center text-surface-primary font-display font-bold text-lg">V</div>
          <span className="hidden lg:block font-display font-bold text-lg tracking-tight">VEYRO</span>
        </Link>
        <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname === item.to || (item.to === "/category" && location.pathname.startsWith("/category"));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition no-tap-highlight",
                  active ? "bg-surface-card text-accent-cyan" : "text-text-muted hover:text-text-primary hover:bg-surface-card/60"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden lg:block px-3 pb-4">
          <CountryWidget />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-surface-primary/80 backdrop-blur-xl border-b border-border-hairline">
          <div className="flex items-center gap-3 h-16 px-4 md:px-8">
            <Link to="/" className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-cyan flex items-center justify-center text-surface-primary font-display font-bold text-lg">V</div>
            </Link>
            <form onSubmit={submitSearch} className="flex-1 max-w-xl relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search premium electronics…"
                className="w-full bg-surface-card border border-border-hairline rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 transition"
              />
            </form>
            <div className="flex items-center gap-1.5">
              <Link to="/orders" className="md:hidden p-2.5 rounded-lg hover:bg-surface-card text-text-muted"><Heart className="w-5 h-5" /></Link>
              <Link to="/cart" className="relative p-2.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition">
                <ShoppingBag className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-cyan text-surface-primary text-[10px] font-bold flex items-center justify-center text-mono">{count}</span>
                )}
              </Link>
              <Link to="/orders" className="hidden md:block p-2.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary transition"><User className="w-5 h-5" /></Link>
              <div className="md:hidden"><CountryWidget /></div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-secondary/95 backdrop-blur-xl border-t border-border-hairline flex items-center justify-around h-16 px-2">
        {NAV.slice(0, 4).map((item) => {
          const active = location.pathname === item.to || (item.to === "/category" && location.pathname.startsWith("/category"));
          return (
            <Link key={item.to} to={item.to} className={cn("flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg no-tap-highlight", active ? "text-accent-cyan" : "text-text-muted")}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}