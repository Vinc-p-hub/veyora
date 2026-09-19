import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Activity, AlertTriangle, Check, X, Database, Cpu, Search, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import CrawlerPanel from "@/components/admin/CrawlerPanel";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "crawler", label: "Crawlers", icon: Cpu },
  { id: "review", label: "Review Queue", icon: AlertTriangle },
  { id: "products", label: "Products", icon: Database },
  { id: "analytics", label: "Search & Audit", icon: Search },
];

export default function Admin() {
  const { user } = useAuth();
  const { currency } = useRegion();
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [review, setReview] = useState([]);
  const [sources, setSources] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  const isAdmin = user?.role === "admin";

  // Server-side role bootstrap: designated accounts are elevated only after the
  // backend verifies the authenticated email. A client-side email match is never enough.
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [all, s, j, o] = await Promise.all([
        base44.entities.Product.list("-created_date", 200),
        base44.entities.CrawlerSource.list("-created_date", 50),
        base44.entities.CrawlerJob.list("-updated_date", 200),
        base44.entities.Order.list("-created_date", 100),
      ]);
      setProducts(all.filter((p) => p.status === "PUBLISHED"));
      setReview(all.filter((p) => p.status === "REVIEW"));
      setSources(s);
      setJobs(j);
      setOrders(o);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  if (!isAdmin) {
    return (
      <div className="px-4 py-20 max-w-md mx-auto text-center">
        <Lock className="w-10 h-10 mx-auto text-text-muted mb-4" />
        <h1 className="font-display font-bold text-xl">Staff access required</h1>
        <p className="text-sm text-text-muted mt-2">
          Admin access is granted by server-side role verification only. If your account is authorized,
          it has been elevated automatically — reload the page.
        </p>
      </div>
    );
  }

  const approve = async (id) => {
    await base44.entities.Product.update(id, { status: "PUBLISHED" });
    const p = review.find((r) => r.id === id);
    setReview((r) => r.filter((x) => x.id !== id));
    if (p) setProducts((list) => [p, ...list]);
  };
  const reject = async (id) => {
    await base44.entities.Product.update(id, { status: "REJECTED" });
    setReview((r) => r.filter((x) => x.id !== id));
  };

  const failedJobs = jobs.filter((j) => j.status === "FAILED").length;
  const activeSources = sources.filter((s) => s.status === "ACTIVE").length;
  const revenue = orders.filter((o) => o.status === "PAID").reduce((s, o) => s + (o.total || 0), 0);
  const activePlans = orders.filter((o) => (o.installment_count || 0) > 0).length;

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1300px] mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-accent-cyan" />
        <h1 className="font-display font-bold text-2xl md:text-3xl">Operations Console</h1>
        <span className="ml-auto text-xs text-text-muted">{user.email} · {user.staff_role || "ADMIN"}</span>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide border-b border-border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition -mb-px",
              tab === t.id ? "border-accent-cyan text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Published" value={products.length} icon={Database} />
            <Stat label="In review" value={review.length} icon={AlertTriangle} accent="amber" />
            <Stat label="Active sources" value={activeSources} icon={Cpu} />
            <Stat label="Crawler errors" value={failedJobs} icon={AlertTriangle} accent={failedJobs > 0 ? "red" : "default"} />
            <Stat label="Orders" value={orders.length} icon={Activity} />
            <Stat label="On installments" value={activePlans} icon={Activity} accent="amber" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
              <h3 className="font-display font-semibold mb-4">Source health</h3>
              {sources.length === 0 ? (
                <p className="text-sm text-text-muted">No sources configured.</p>
              ) : (
                <div className="space-y-3">
                  {sources.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-text-muted truncate">{s.name}</span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          s.status === "ACTIVE" ? "text-emerald-600" : s.status === "WARNING" ? "text-amber-600" : s.status === "ERROR" ? "text-red-600" : "text-text-muted"
                        )}
                      >
                        {s.status} · {s.products_updated || 0} ok / {s.products_failed || 0} failed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
              <h3 className="font-display font-semibold mb-4">Revenue (all currencies)</h3>
              <div className="font-display font-bold text-3xl">{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-text-muted mt-1">Sum of paid order totals across all countries.</p>
            </div>
          </div>
        </div>
      )}

      {tab === "crawler" && <CrawlerPanel onChanged={loadData} />}

      {tab === "review" && (
        <div className="space-y-3">
          {loading ? (
            <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
          ) : review.length === 0 ? (
            <div className="text-center py-16 text-text-muted text-sm">
              <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              Review queue is empty. Every crawled product passed quality checks.
            </div>
          ) : (
            review.map((p) => (
              <div key={p.id} className="flex items-center gap-4 bg-surface-card border border-amber-400/30 rounded-lg p-3">
                <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-text-muted">
                    {p.brand} · quality {Math.round((p.data_quality_score || 0) * 100)}% · premium {p.premium_score} · match {Math.round((p.match_confidence || 0) * 100)}%
                  </div>
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-text-muted truncate">
                    Source: {p.source_name} · {p.source_price} {p.currency} → VEYRO {formatPrice(p.customer_price, currency)}
                  </div>
                  {p.review_reason && <div className="text-xs text-amber-600">Reason: {p.review_reason}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approve(p.id)} className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm flex items-center gap-1.5 hover:bg-emerald-500/20"><Check className="w-4 h-4" /> Approve</button>
                  <button onClick={() => reject(p.id)} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-sm flex items-center gap-1.5 hover:bg-red-500/20"><X className="w-4 h-4" /> Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-2">
          {products.map((p) => (
            <Link key={p.id} to={`/product/${p.slug}`} className="flex items-center gap-3 bg-surface-card border border-border-hairline rounded-lg p-3 hover:border-accent-cyan/40 transition">
              <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-text-muted">{p.brand} · {p.category} · score {p.premium_score} · via {p.source_name}</div>
              </div>
              <div className="text-mono text-sm">{formatPrice(p.customer_price, currency)}</div>
              <span className={cn("text-[10px] px-2 py-0.5 rounded", p.stock_status === "IN_STOCK" ? "text-emerald-600 bg-emerald-500/10" : "text-amber-600 bg-amber-500/10")}>{(p.stock_status || "UNKNOWN").replace(/_/g, " ")}</span>
            </Link>
          ))}
        </div>
      )}

      {tab === "analytics" && <AnalyticsPanel />}
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }) {
  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
        <Icon className={cn("w-4 h-4", accent === "red" ? "text-red-600" : accent === "amber" ? "text-amber-600" : "text-accent-cyan")} />
      </div>
      <div className="font-display font-bold text-2xl">{value}</div>
    </div>
  );
}