// SUPER ADMIN CONSOLE — completely separate from the public marketplace.
// No public header/footer, no customer chrome: direct URL access only.
// Access is granted exclusively by the server (ensureStaffRoles verifies the
// authenticated email against the designated SUPER_ADMIN accounts server-side).
import React, { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Shield, LayoutDashboard, AlertTriangle, Database, Package, Handshake, Cpu,
  BarChart3, Coins, Globe, Users, Headphones, ScrollText, Lock, LogOut, Percent, Tag, Images,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const MENU = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/approval-queue", label: "Approval queue", icon: AlertTriangle },
  { to: "/admin/products", label: "Products", icon: Database },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/partners", label: "Partners", icon: Handshake },
  { to: "/admin/offers", label: "Offers", icon: Tag },
  { to: "/admin/sources", label: "Crawler sources", icon: Cpu },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/pricing", label: "Pricing & rules", icon: Percent },
  { to: "/admin/currency-settings", label: "Currencies", icon: Coins },
  { to: "/admin/settings", label: "Countries", icon: Globe },
  { to: "/admin/cms", label: "CMS & Hero", icon: Images },
  { to: "/admin/users", label: "Users & roles", icon: Users },
  { to: "/admin/support", label: "Support", icon: Headphones },
  { to: "/admin/logs", label: "Audit logs", icon: ScrollText },
];

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [bootstrapped, setBootstrapped] = useState(false);

  // Server-side role bootstrap: designated accounts are elevated only after the
  // backend verifies the authenticated email. A client-side match is never enough.
  useEffect(() => {
    if (user && !isAdmin && !bootstrapped) {
      setBootstrapped(true);
      base44.functions
        .invoke("ensureStaffRoles", {})
        .then((res) => {
          if (res.data?.reload) window.location.reload();
        })
        .catch(() => {});
    }
  }, [user, isAdmin, bootstrapped]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-surface-primary flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Lock className="w-10 h-10 mx-auto text-text-muted mb-4" />
          <h1 className="font-display font-bold text-xl">Restricted area</h1>
          <p className="text-sm text-text-muted mt-2">
            VEYRO Operations is a private console. Access is granted by server-side role
            verification only — if your account is authorized it has been elevated
            automatically, reload the page.
          </p>
          <button onClick={() => base44.auth.logout("/login")}
            className="mt-6 px-5 py-2.5 rounded-lg border border-border-hairline text-sm hover:border-accent-cyan/40">
            Sign in with a staff account
          </button>
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
            onClick={() => base44.auth.logout("/login")}
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