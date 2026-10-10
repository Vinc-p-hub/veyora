import React, { useEffect, useState } from "react";
import { Sparkles, Smartphone, Laptop, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

const DAY = 86400000;
const since = (days) => Date.now() - days * DAY;

function timeAgo(iso) {
  if (!iso) return "—";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// New arrivals & catalog activity — stats computed from the real crawled
// catalog only (discovery dates, price/stock movements tracked by the worker).
export default function NewArrivalsStats() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.entities.Product.list("-created_date", 500)
      .then(setProducts)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-text-muted">Failed to load catalog activity.</p>;
  if (!products) return <div className="h-40 bg-surface-card rounded-lg animate-pulse" />;

  const ts = (iso) => (iso ? new Date(iso).getTime() : 0);
  const discovered30 = products.filter((p) => ts(p.created_date) >= since(30));
  const discovered7 = products.filter((p) => ts(p.created_date) >= since(7));
  const newPhones = discovered30.filter((p) => ["Smartphones", "Phones"].includes(p.category));
  const newLaptops = discovered30.filter((p) => ["Laptops", "Computers", "Computer Components"].includes(p.category));

  const byBrand = Object.entries(
    discovered30.reduce((m, p) => {
      const b = p.brand || "Unknown";
      m[b] = (m[b] || 0) + 1;
      return m;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxBrand = byBrand[0]?.[1] || 1;

  const recentUpdates = [...products]
    .sort((a, b) => ts(b.updated_date) - ts(a.updated_date))
    .slice(0, 10);
  const priceChanged = products.filter((p) => ts(p.price_changed_at) >= since(7));
  const stockChanged = products.filter((p) => ts(p.stock_changed_at) >= since(2));

  const cards = [
    { label: "New products discovered (7d)", value: discovered7.length, icon: Sparkles },
    { label: "New products discovered (30d)", value: discovered30.length, icon: Sparkles },
    { label: "New smartphones (30d)", value: newPhones.length, icon: Smartphone },
    { label: "New laptops & computers (30d)", value: newLaptops.length, icon: Laptop },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-surface-card border border-border-hairline rounded-lg p-4">
            <div className="text-[9px] uppercase tracking-widest text-text-muted flex items-center gap-1">
              <c.icon className="w-3 h-3" /> {c.label}
            </div>
            <div className="font-display font-bold text-2xl mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* New products by brand (30d) */}
        <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
          <h3 className="font-display font-semibold mb-4">New products by brand (30d)</h3>
          {byBrand.length === 0 ? (
            <p className="text-sm text-text-muted">No products discovered in the last 30 days — run the crawler.</p>
          ) : (
            <div className="space-y-2">
              {byBrand.map(([brand, n]) => (
                <div key={brand} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-xs text-text-muted truncate">{brand}</span>
                  <div className="flex-1 h-5 bg-surface-primary rounded overflow-hidden">
                    <div
                      className={cn("h-full rounded", n === maxBrand ? "bg-noon" : "bg-accent-cyan/60")}
                      style={{ width: `${Math.max(4, (n / maxBrand) * 100)}%` }}
                    />
                  </div>
                  <span className="text-mono text-xs w-8 text-right shrink-0">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest updates — price & stock movements tracked by the pipeline */}
        <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Latest catalog updates</h3>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {priceChanged.length} price · {stockChanged.length} stock</span>
            </div>
          </div>
          <div className="divide-y divide-border-hairline">
            {recentUpdates.map((p) => {
              const priceDown = p.previous_price != null && p.customer_price != null && p.customer_price < p.previous_price;
              const priceUp = p.previous_price != null && p.customer_price != null && p.customer_price > p.previous_price;
              const stockMoved = ts(p.stock_changed_at) >= since(2);
              return (
                <div key={p.id} className="flex items-center gap-2 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-text-muted">{p.brand} · {p.category} · {timeAgo(p.updated_date)}</div>
                  </div>
                  {priceDown && <span className="flex items-center gap-0.5 text-emerald-600 font-semibold shrink-0"><TrendingDown className="w-3 h-3" />price</span>}
                  {priceUp && <span className="flex items-center gap-0.5 text-red-500 font-semibold shrink-0"><TrendingUp className="w-3 h-3" />price</span>}
                  {stockMoved && <span className="text-[10px] bg-noon text-noon-fg font-bold px-1.5 py-0.5 rounded shrink-0">STOCK</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}