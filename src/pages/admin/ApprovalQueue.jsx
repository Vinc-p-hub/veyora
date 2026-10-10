import React, { useCallback, useEffect, useState } from "react";
import { Check, X, AlertTriangle } from "lucide-react";
import { api } from "@/api/client";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";

// Manual validation of crawled products that ended up in REVIEW —
// exact rejection/match reasons shown per product.
export default function ApprovalQueue() {
  const { currency } = useRegion();
  const [review, setReview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.entities.Product.list("-created_date", 200);
      setReview(list.filter((p) => p.status === "REVIEW"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    setBusy(true);
    await api.entities.Product.update(id, { status: "PUBLISHED", review_reason: null });
    setReview((r) => r.filter((x) => x.id !== id));
    setBusy(false);
  };
  const reject = async (id) => {
    setBusy(true);
    await api.entities.Product.update(id, { status: "REJECTED" });
    setReview((r) => r.filter((x) => x.id !== id));
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl">Approval queue ({review.length})</h1>

      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : review.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
          Queue empty — every crawled product passed quality checks.
        </div>
      ) : (
        review.map((p) => (
          <div key={p.id} className="flex items-center gap-4 bg-surface-card border border-amber-400/30 rounded-lg p-3">
            <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-secondary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-text-muted">
                {p.brand} · quality {Math.round((p.data_quality_score || 0) * 100)}% · premium {p.premium_score} · match {Math.round((p.match_confidence || 0) * 100)}%
              </div>
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-text-muted truncate">
                Source: {p.source_name} · {p.source_price} {p.currency} → VEYRO {formatPrice(p.customer_price, currency)}
              </div>
              {p.review_reason && <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" /> {p.review_reason}</div>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => approve(p.id)} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm flex items-center gap-1.5 hover:bg-emerald-500/20 disabled:opacity-40"><Check className="w-4 h-4" /> Approve</button>
              <button onClick={() => reject(p.id)} disabled={busy} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 text-sm flex items-center gap-1.5 hover:bg-red-500/20 disabled:opacity-40"><X className="w-4 h-4" /> Reject</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}