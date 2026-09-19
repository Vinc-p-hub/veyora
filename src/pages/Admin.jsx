import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Activity, AlertTriangle, Check, X, RefreshCw, Play, Pause, Database, Cpu } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "review", label: "Review Queue", icon: AlertTriangle },
  { id: "crawler", label: "Crawler", icon: Cpu },
  { id: "products", label: "Products", icon: Database },
];

// Mock crawler sources — represents the adapter/queue/worker architecture
const SOURCES = [
  { id: "src_a", name: "Authorized Sony Reseller", status: "HEALTHY", lastRun: "2 min ago", nextRun: "in 13 min", discovered: 1240, updated: 86, rejected: 12, published: 1128, errors: 0, latency: "420ms" },
  { id: "src_b", name: "Authorized Apple Reseller", status: "HEALTHY", lastRun: "5 min ago", nextRun: "in 25 min", discovered: 980, updated: 54, rejected: 3, published: 947, errors: 0, latency: "380ms" },
  { id: "src_c", name: "Authorized Bose Reseller", status: "WARNING", lastRun: "8 min ago", nextRun: "in 52 min", discovered: 540, updated: 22, rejected: 31, published: 487, errors: 7, latency: "1.2s" },
  { id: "src_d", name: "Authorized Samsung Reseller", status: "HEALTHY", lastRun: "1 min ago", nextRun: "in 9 min", discovered: 1620, updated: 110, rejected: 8, published: 1512, errors: 1, latency: "450ms" },
];

const ERROR_LOG = [
  { source: "Authorized Bose Reseller", url: "/products/qc-ultra-eu", type: "PARSER_ERROR", status: 200, msg: "Price field missing structured data", attempt: 2, time: "08:14" },
  { source: "Authorized Bose Reseller", url: "/products/nc700-refurb", type: "INVALID_DATA", status: 200, msg: "Currency code null", attempt: 1, time: "08:12" },
  { source: "Authorized Samsung Reseller", url: "/products/galaxy-watch-fe", type: "TIMEOUT", status: 0, msg: "Request exceeded 10s", attempt: 3, time: "08:09" },
];

const STATUS_COLOR = { HEALTHY: "text-emerald-400", WARNING: "text-amber-400", ERROR: "text-red-400", DISABLED: "text-text-muted" };

export default function Admin() {
  const { currency } = useRegion();
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [review, setReview] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.entities.Product.list("-created_date", 100)
      .then((all) => {
        setProducts(all.filter((p) => p.status === "PUBLISHED"));
        setReview(all.filter((p) => p.status === "REVIEW"));
      })
      .finally(() => setLoading(false));
  }, [tab]);

  const approve = async (id) => {
    await base44.entities.Product.update(id, { status: "PUBLISHED" });
    setReview((r) => r.filter((p) => p.id !== id));
    setProducts((p) => [review.find((r) => r.id === id), ...p].filter(Boolean));
  };
  const reject = async (id) => {
    await base44.entities.Product.update(id, { status: "REJECTED" });
    setReview((r) => r.filter((p) => p.id !== id));
  };

  const totalProducts = products.length + review.length;
  const totalErrors = SOURCES.reduce((s, x) => s + x.errors, 0);

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1300px] mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-accent-cyan" />
        <h1 className="font-display font-bold text-2xl md:text-3xl">Admin Console</h1>
      </div>

      {/* Tabs */}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Published products" value={products.length} icon={Database} />
            <Stat label="In review queue" value={review.length} icon={AlertTriangle} accent="amber" />
            <Stat label="Active sources" value={SOURCES.filter((s) => s.status === "HEALTHY").length} icon={Cpu} />
            <Stat label="Crawler errors (24h)" value={totalErrors} icon={AlertTriangle} accent={totalErrors > 5 ? "red" : "default"} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
              <h3 className="font-display font-semibold mb-4">Crawler health</h3>
              <div className="space-y-3">
                {SOURCES.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-muted truncate">{s.name}</span>
                    <span className={cn("text-xs font-medium", STATUS_COLOR[s.status])}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
              <h3 className="font-display font-semibold mb-4">Pipeline throughput</h3>
              <div className="space-y-3 text-sm">
                <Row label="Products discovered / hr" value={SOURCES.reduce((s, x) => s + x.discovered, 0).toLocaleString()} />
                <Row label="Products updated / hr" value={SOURCES.reduce((s, x) => s + x.updated, 0).toLocaleString()} />
                <Row label="Rejected (quality)" value={SOURCES.reduce((s, x) => s + x.rejected, 0)} />
                <Row label="Published" value={SOURCES.reduce((s, x) => s + x.published, 0).toLocaleString()} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "review" && (
        <div className="space-y-3">
          {loading ? (
            <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
          ) : review.length === 0 ? (
            <div className="text-center py-16 text-text-muted text-sm">
              <Check className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              Review queue is empty. All crawled products passed quality checks.
            </div>
          ) : (
            review.map((p) => (
              <div key={p.id} className="flex items-center gap-4 bg-surface-card border border-amber-400/20 rounded-lg p-3">
                <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-text-muted">{p.brand} · score {p.premium_score} · match {Math.round(p.match_confidence * 100)}%</div>
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-text-muted">Source: {p.source_price} → VEYRO: {formatPrice(p.customer_price, currency)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(p.id)} className="px-3 py-2 rounded-lg bg-emerald-400/10 text-emerald-400 text-sm flex items-center gap-1.5 hover:bg-emerald-400/20"><Check className="w-4 h-4" /> Approve</button>
                  <button onClick={() => reject(p.id)} className="px-3 py-2 rounded-lg bg-red-400/10 text-red-400 text-sm flex items-center gap-1.5 hover:bg-red-400/20"><X className="w-4 h-4" /> Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "crawler" && (
        <div className="space-y-6">
          <div className="grid gap-3">
            {SOURCES.map((s) => (
              <div key={s.id} className="bg-surface-card border border-border-hairline rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-md border", STATUS_COLOR[s.status], "border-current/30")}>{s.status}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">Last run {s.lastRun} · Next {s.nextRun} · avg {s.latency}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs flex items-center gap-1.5 hover:border-accent-cyan/40"><Play className="w-3.5 h-3.5" /> Run now</button>
                    <button className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs flex items-center gap-1.5 hover:border-accent-cyan/40"><Pause className="w-3.5 h-3.5" /> Pause</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
                  <Mini label="Discovered" value={s.discovered} />
                  <Mini label="Updated" value={s.updated} />
                  <Mini label="Rejected" value={s.rejected} />
                  <Mini label="Published" value={s.published} />
                  <Mini label="Errors" value={s.errors} accent={s.errors > 0 ? "red" : "default"} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4"><AlertTriangle className="w-4 h-4 text-amber-400" /><h3 className="font-display font-semibold">Crawler errors</h3></div>
            <div className="space-y-2">
              {ERROR_LOG.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs py-2 border-b border-border-hairline last:border-0">
                  <span className={cn("text-mono px-2 py-0.5 rounded border", e.type === "TIMEOUT" ? "text-amber-400 border-amber-400/30" : "text-red-400 border-red-400/30")}>{e.type}</span>
                  <span className="text-text-muted">{e.source}</span>
                  <span className="text-mono text-text-muted truncate">{e.url}</span>
                  <span className="text-text-muted ml-auto">HTTP {e.status} · attempt {e.attempt} · {e.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-2">
          {products.map((p) => (
            <Link key={p.id} to={`/product/${p.slug}`} className="flex items-center gap-3 bg-surface-card border border-border-hairline rounded-lg p-3 hover:border-accent-cyan/40 transition">
              <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-text-muted">{p.brand} · {p.category} · score {p.premium_score}</div>
              </div>
              <div className="text-mono text-sm">{formatPrice(p.customer_price, currency)}</div>
              <span className={cn("text-[10px] px-2 py-0.5 rounded", p.stock_status === "IN_STOCK" ? "text-emerald-400 bg-emerald-400/10" : "text-amber-400 bg-amber-400/10")}>{p.stock_status.replace(/_/g, " ")}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }) {
  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
        <Icon className={cn("w-4 h-4", accent === "red" ? "text-red-400" : accent === "amber" ? "text-amber-400" : "text-accent-cyan")} />
      </div>
      <div className="font-display font-bold text-2xl">{value}</div>
    </div>
  );
}
function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-text-muted">{label}</span><span className="text-mono">{value}</span></div>;
}
function Mini({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-surface-primary py-2">
      <div className="text-[9px] uppercase text-text-muted">{label}</div>
      <div className={cn("text-mono font-semibold", accent === "red" ? "text-red-400" : "text-text-primary")}>{value}</div>
    </div>
  );
}