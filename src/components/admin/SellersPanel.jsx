import React, { useCallback, useEffect, useState } from "react";
import { Store, ExternalLink } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

// Seller management — real partner sellers created by the catalog pipeline
// (one per authorized merchant source). Shows live offer counts and lets the
// Super Admin deactivate a seller.
export default function SellersPanel() {
  const [sellers, setSellers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        api.entities.Seller.list("name", 200),
        api.entities.Offer.list(null, 1000),
      ]);
      setSellers(s);
      setOffers(o);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (s) => {
    await api.entities.Seller.update(s.id, { active: !s.active });
    load();
  };

  const countFor = (id) => offers.filter((o) => o.seller_id === id).length;

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Store className="w-4 h-4 text-accent-cyan" /> Sellers ({sellers.length})
        </h3>
        <span className="text-xs text-text-muted">{offers.length} live offers</span>
      </div>
      <p className="text-xs text-text-muted mb-3">
        Identified partner sellers — created automatically from authorized crawler sources, shown on every product
        page ("Sold by") and compared at checkout.
      </p>
      {loading ? (
        <div className="h-20 rounded-lg animate-pulse bg-surface-primary" />
      ) : sellers.length === 0 ? (
        <p className="text-sm text-text-muted">
          No sellers yet — they are created automatically the first time a crawled product is published with an offer.
        </p>
      ) : (
        <div className="space-y-2">
          {sellers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border-hairline last:border-0">
              <div className="min-w-0">
                <span className="font-medium">{s.name}</span>
                {s.verified && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">verified</span>}
                <div className="text-[11px] text-text-muted">
                  {countFor(s.id)} offers · reliability {Math.round(s.supplier_score || 80)}/100
                  {s.countries?.length ? ` · ships to ${s.countries.join(", ")}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.website && (
                  <a href={s.website} target="_blank" rel="noreferrer" className="p-1.5 rounded-md hover:bg-surface-secondary text-text-muted hover:text-text-primary">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => toggle(s)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded font-medium",
                    s.active ? "bg-emerald-500/10 text-emerald-600" : "bg-surface-secondary text-text-muted"
                  )}
                >
                  {s.active ? "active" : "disabled"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}