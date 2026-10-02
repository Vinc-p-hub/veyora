import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import Stars from "@/components/reviews/Stars";
import ManualSourceReviewForm from "@/components/admin/reviews/ManualSourceReviewForm";
import ReviewFileImport from "@/components/admin/reviews/ReviewFileImport";

// Reviews attached to ONE product (the product module of the back office).
// Staff can paste a real partner review verbatim or import a file of real
// reviews — both land as SourceReviews and show immediately on the product page.
export default function ProductReviews({ product }) {
  const [reviews, setReviews] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const list = await base44.entities.SourceReview.filter({ product_id: product.id }, "-created_date", 200);
    setReviews(list);
  }, [product.id]);

  useEffect(() => {
    load().catch(() => setReviews([]));
  }, [load]);

  const moderate = async (review, action) => {
    if (action === "DELETE" && !window.confirm("Permanently delete this review?")) return;
    setBusyId(review.id);
    try {
      await base44.functions.invoke("reviewModerate", { review_id: review.id, action, scope: "source" });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const created = (message) => {
    setMsg(message || "");
    load();
  };

  return (
    <section className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-badge-premium" /> Reviews ({reviews?.length ?? 0})
        </h2>
        <span className="text-[11px] text-text-muted">
          Real reviews only — pasted verbatim or imported, never invented or rewritten.
        </span>
      </div>

      {msg && <div className="rounded-lg bg-surface-primary p-3 text-xs">{msg}</div>}

      <div className="flex flex-wrap items-start gap-3">
        <ManualSourceReviewForm
          onCreated={() => created("Review published — it is now live on the product page.")}
          productId={product.id}
          productName={product.name}
        />
        <ReviewFileImport product={product} onImported={created} />
      </div>

      {reviews === null ? (
        <div className="h-20 rounded-lg animate-pulse bg-surface-primary" />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-text-muted">No reviews on this product yet — add one manually or import a file.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-border-hairline p-3.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded border border-current/30 font-semibold",
                    r.status === "ACTIVE" ? "text-emerald-600" : "text-text-muted"
                  )}
                >
                  {r.status}
                </span>
                <Stars value={r.rating} />
                <span className="font-semibold">{r.source_name}</span>
                <span className="text-text-muted">{r.author}</span>
                {r.review_url && (
                  <a
                    href={r.review_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent-cyan hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> original
                  </a>
                )}
                <span className="text-text-muted ms-auto">
                  {r.created_date ? new Date(r.created_date).toLocaleDateString() : ""}
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1.5">{r.text}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {r.status === "ACTIVE" ? (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => moderate(r, "HIDE")}
                    className="px-3 py-1.5 rounded-md border border-border-hairline text-xs disabled:opacity-40"
                  >
                    Hide
                  </button>
                ) : (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => moderate(r, "RESTORE")}
                    className="px-3 py-1.5 rounded-md border border-border-hairline text-xs disabled:opacity-40"
                  >
                    Restore
                  </button>
                )}
                <button
                  disabled={busyId === r.id}
                  onClick={() => moderate(r, "DELETE")}
                  className="px-3 py-1.5 rounded-md border border-red-300 text-red-600 text-xs disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}