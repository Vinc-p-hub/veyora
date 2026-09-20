import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import Stars from "@/components/reviews/Stars";
import ManualSourceReviewForm from "@/components/admin/reviews/ManualSourceReviewForm";

// Imported source reviews — verbatim reviews from authorized merchants. The
// admin can hide/restore/delete them; the text itself is immutable. Staff can
// also paste a real partner review manually (stored verbatim, source-labeled).
export default function SourceReviewsAdmin() {
  const [reviews, setReviews] = useState(null);
  const [productNames, setProductNames] = useState({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const list = await base44.entities.SourceReview.list("-created_date", 200);
    setReviews(list);
    const ids = [...new Set(list.map((r) => r.product_id))].slice(0, 100);
    const names = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const p = await base44.entities.Product.get(id);
          names[id] = { name: p.name, slug: p.slug };
        } catch (_e) {
          names[id] = { name: null, slug: null };
        }
      })
    );
    setProductNames(names);
  }, []);

  useEffect(() => {
    load().catch(() => setReviews([]));
  }, [load]);

  const moderate = async (review, action) => {
    if (action === "DELETE" && !window.confirm("Permanently delete this imported review?")) return;
    setBusyId(review.id);
    try {
      await base44.functions.invoke("reviewModerate", { review_id: review.id, action, scope: "source" });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const qp = q.trim().toLowerCase();
    return (reviews || []).filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (qp) {
        const pn = productNames[r.product_id]?.name || "";
        if (!pn.toLowerCase().includes(qp) && !(r.author || "").toLowerCase().includes(qp) && !(r.text || "").toLowerCase().includes(qp)) return false;
      }
      return true;
    });
  }, [reviews, q, status, productNames]);

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <ManualSourceReviewForm onCreated={load} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product, author or review text…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-hairline text-xs"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-border-hairline text-xs">
          {["ALL", "ACTIVE", "HIDDEN", "REJECTED"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {reviews === null ? (
        <div className="h-24 rounded-lg animate-pulse bg-surface-primary" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted">
          No source reviews yet. The crawler imports them automatically from merchants that publish them, or add a real partner review manually with “Add partner review”.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const p = productNames[r.product_id];
            return (
              <div key={r.id} className="rounded-lg border border-border-hairline p-3.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("px-2 py-0.5 rounded border border-current/30 font-semibold", r.status === "ACTIVE" ? "text-emerald-600" : "text-text-muted")}>{r.status}</span>
                  <Stars value={r.rating} />
                  <span className="font-semibold">{r.source_name}</span>
                  <span className="text-text-muted">{r.author}</span>
                  {r.review_url && (
                    <a href={r.review_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-cyan hover:underline">
                      <ExternalLink className="w-3 h-3" /> original
                    </a>
                  )}
                  <span className="text-text-muted ms-auto">{new Date(r.created_date).toLocaleString()}</span>
                </div>
                <div className="mt-1.5 text-sm">
                  on {p?.slug ? <Link to={`/product/${p.slug}`} className="text-accent-cyan hover:underline">{p.name}</Link> : <span className="text-text-muted">a removed product</span>}
                </div>
                <p className="text-sm text-text-muted mt-0.5">{r.text}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {r.status === "ACTIVE" ? (
                    <Btn disabled={busyId === r.id} onClick={() => moderate(r, "HIDE")}>Hide</Btn>
                  ) : (
                    <Btn disabled={busyId === r.id} onClick={() => moderate(r, "RESTORE")}>Restore</Btn>
                  )}
                  <Btn disabled={busyId === r.id} onClick={() => moderate(r, "DELETE")} danger>Delete</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Btn({ children, danger, ...props }) {
  return (
    <button
      {...props}
      className={cn(
        "px-3 py-1.5 rounded-md border text-xs font-medium disabled:opacity-40",
        danger ? "border-red-300 text-red-600 hover:border-red-400" : "border-border-hairline hover:border-accent-cyan/40"
      )}
    >
      {children}
    </button>
  );
}