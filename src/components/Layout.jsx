import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { ShoppingBag, User, Compass, LayoutGrid, Package, Search as SearchIcon, Heart } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import SearchBar from "@/components/SearchBar";
import RegionLangMenu from "@/components/RegionLangMenu";
import CategoryNav from "@/components/CategoryNav";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

// Public marketplace navigation — the Super Admin console (/admin) is
// intentionally absent from every menu, header and footer here.
const CATS = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components",
];

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
  const { user } = useAuth();
  return (
    <footer className="bg-noon text-noon-fg mt-10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-5 gap-8">
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
            <Link to="/contact" className="block hover:underline">Contact us</Link>
            {!user && (
              <>
                <Link to="/login" className="block hover:underline font-semibold">{t("profile.loginCta")}</Link>
                <Link to="/register" className="block hover:underline">{t("profile.registerCta")}</Link>
              </>
            )}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-sm mb-3">Legal &amp; policies</h4>
          <div className="space-y-2 text-xs opacity-80">
            <Link to="/legal" className="block hover:underline">Legal center</Link>
            <Link to="/terms" className="block hover:underline">Terms of service</Link>
            <Link to="/privacy" className="block hover:underline">Privacy policy</Link>
            <Link to="/refund-policy" className="block hover:underline">Refund policy</Link>
            <Link to="/shipping-policy" className="block hover:underline">Shipping policy</Link>
            <Link to="/return-policy" className="block hover:underline">Return policy</Link>
            <Link to="/warranty" className="block hover:underline">Warranty</Link>
            <Link to="/seller-policy" className="block hover:underline">Seller policy</Link>
            <Link to="/reviews-policy" className="block hover:underline">Reviews policy</Link>
            <Link to="/cookie-policy" className="block hover:underline">Cookie policy</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-black/10 py-4 pb-20 md:pb-4 text-center text-[11px] font-medium">
        © 2026 VEYRO — Premium electronics, paid your way.
      </div>
    </footer>
  );
}

export default function Layout() {
  const { count } = useCart();
  const { user } = useAuth();
  const { t, tCat } = useLang();
  const location = useLocation();
  const catParam = new URLSearchParams(location.search).get("cat");

  const NAV = [
    { to: "/", label: t("nav.home"), icon: Compass },
    { to: "/category", label: t("nav.search"), icon: SearchIcon, search: true },
    { to: "/category", label: t("nav.categories"), icon: LayoutGrid },
    { to: "/orders", label: t("nav.orders"), icon: Package },
    { to: user ? "/profile" : "/login", label: user ? t("nav.account") : t("profile.loginCta"), icon: User },
  ];

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary flex flex-col">
      {/* Noon-style yellow header */}
      <header className="sticky top-0 z-30 bg-noon text-noon-fg shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 md:px-8">
          <div className="flex items-center gap-3 md:gap-6 h-14 md:h-[68px]">
            <Link to="/" className="shrink-0" aria-label="VEYRO">
              <span className="font-display font-extrabold text-xl md:text-[28px] leading-none tracking-tight">veyro</span>
            </Link>
            {/* Desktop: prominent, centered search */}
            <div className="hidden md:flex flex-1 min-w-0 justify-center">
              <SearchBar />
            </div>
            <div className="flex items-center gap-4 md:gap-5 shrink-0 ms-auto">
              <RegionLangMenu />
              <div className="hidden md:flex items-center gap-5">
                {user ? (
                  <HeaderAction to="/profile" icon={User} label={t("nav.account")} />
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="px-4 py-2 rounded-lg bg-noon-fg text-white text-xs font-semibold hover:opacity-90 transition no-tap-highlight">
                      {t("profile.loginCta")}
                    </Link>
                    <Link to="/register" className="px-4 py-2 rounded-lg border border-noon-fg/25 text-xs font-semibold hover:border-noon-fg/60 transition no-tap-highlight">
                      {t("profile.registerCta")}
                    </Link>
                  </div>
                )}
                <HeaderAction to="/orders" icon={Package} label={t("nav.orders")} />
                <HeaderAction to="/wishlist" icon={Heart} label={t("nav.wishlist")} />
                <HeaderAction to="/cart" icon={ShoppingBag} label={t("footer.cart")} badge={count} />
              </div>
              {/* Mobile: minimal top row — search gets its own full-width row below */}
              <div className="md:hidden flex items-center gap-4">
                <HeaderAction to="/wishlist" icon={Heart} label="" />
                <HeaderAction to="/cart" icon={ShoppingBag} label="" badge={count} />
              </div>
            </div>
          </div>
          {/* Mobile: full-width search on its own row — always visible, never squeezed */}
          <div className="md:hidden pb-2.5">
            <SearchBar />
          </div>
        </div>
        {/* Category navigation — dropdown + tidy contained strip */}
        <CategoryNav />
      </header>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      <Footer />

      {/* Mobile bottom nav: Home / Search / Categories / Orders / Account */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border-hairline flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]">
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