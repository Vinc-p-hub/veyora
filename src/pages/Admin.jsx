// SUPER ADMIN CONSOLE — completely separate from the public marketplace.
// No public header/footer, no customer chrome: direct URL access only.
// Access is granted exclusively by the server (ensureStaffRoles verifies the
// authenticated email against the designated SUPER_ADMIN accounts server-side).
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Shield, LayoutDashboard, AlertTriangle, Database, Package, Handshake, Cpu,
  BarChart3, Coins, Globe, Users, Headphones, ScrollText, Lock, LogOut, Percent, Tag, Images, Star, Github, Boxes, BadgePercent, CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

// Hard allowlist — even an account that somehow carries the admin role is
// refused here unless its email is one of the designated founder accounts.
const ALLOWED_EMAILS = [
  "webdxb1@gmail.com",
  "vincentnogue2@gmail.com",
  "vincentnogue@yahoo.com",
];

const MENU = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/approval-queue", label: "Approval queue", icon: AlertTriangle },
  { to: "/admin/products", label: "Products", icon: Database },
  { to: "/admin/stock", label: "Stock", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/partners", label: "Partners", icon: Handshake },
  { to: "/admin/offers", label: "Offers", icon: Tag },
  { to: "/admin/sources", label: "Crawler sources", icon: Cpu },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/pricing", label: "Pricing & rules", icon: Percent },
  { to: "/admin/promotions", label: "Promotions", icon: BadgePercent },
  { to: "/admin/currency-settings", label: "Currencies", icon: Coins },
  { to: "/admin/payment-providers", label: "Payment providers", icon: CreditCard },
  { to: "/admin/markets", label: "Markets", icon: Globe },
  { to: "/admin/settings", label: "Country settings", icon: Globe },
  { to: "/admin/cms", label: "CMS & Hero", icon: Images },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/users", label: "Users & roles", icon: Users },
  { to: "/admin/support", label: "Support", icon: Headphones },
  { to: "/admin/logs", label: "Audit logs", icon: ScrollText },
  { to: "/admin/github", label: "GitHub", icon: Github },
];

export default function Admin() {
  const { user, isLoadingAuth, logout } = useAuth();
  // Console access: a super admin appointed from the back office (server-set
  // staff_role) — or one of the founder accounts.
  const isAdmin =
    user?.role === "admin" &&
    (user?.staff_role === "SUPER_ADMIN" ||
      ALLOWED_EMAILS.includes(String(user?.email || "").toLowerCase()));

  // Never show the denial screen while the session is still being resolved.
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Lock className="w-10 h-10 mx-auto text-text-muted mb-4" />
          <h1 className="font-display font-bold text-xl">Restricted area</h1>
          {user ? (
            <>
              <p className="text-sm text-text-muted mt-2">
                You are signed in as{" "}
                <span className="text-text-primary font-medium">{user.email}</span>, which is not
                an authorized VEYRO operations account.
              </p>
              <button
                onClick={() => logout("/login?returnTo=%2Fadmin")}
                className="mt-6 px-5 py-2.5 rounded-lg border border-border-hairline text-sm hover:border-accent-cyan/40"
              >
                Sign out and use a staff account
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted mt-2">
                VEYRO Operations is a private console. Sign in with an authorized staff account to
                continue.
              </p>
              <a
                href="/login?returnTo=%2Fadmin"
                className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90"
              >
                Sign in to VEYRO Ops
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-60 shrink-0 bg-noon-fg text-white md:min-h-screen">
        <div className="flex items-center gap-2 px-5 h-16">
          <Shield className="w-5 h-5 text-noon" />
          <div>
            <div className="font-display font-extrabold leading-none">VEYRO OPS</div>
            <div className="text-[10px] opacity-60 mt-0.5">{user.staff_role || "ADMIN"}</div>
          </div>
          <button
            onClick={() => logout("/login")}
            className="ms-auto p-2 rounded-lg hover:bg-white/10"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex md:flex-col gap-1 px-3 pb-3 overflow-x-auto scrollbar-hide">
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition",
                  isActive ? "bg-noon text-noon-fg font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"
                )
              }
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}