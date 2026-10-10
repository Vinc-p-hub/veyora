import React, { useEffect, useState } from "react";
import { ExternalLink, Store } from "lucide-react";
import { api } from "@/api/client";
import { useLang } from "@/lib/i18n";
import Stars from "./Stars";

// Imported source reviews — real reviews published on authorized merchant
// sources and imported verbatim with their permission. Clearly identified as
// source reviews, never presented as VEYRO customer reviews.
export default function SourceReviews({ product }) {
  const { t } = useLang();
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    let live = true;
    api.entities.SourceReview.filter({ product_id: product.id, status: "ACTIVE" }, "-imported_at", 20)
      .then((rows) => live && setReviews(rows))
      .catch(() => live && setReviews([]));
    return () => {
      live = false;
    };
  }, [product?.id]);

  if (reviews === null) return null;

  return (
    <section className="bg-surface-card border border-border-hairline rounded-xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display font-bold text-lg">{t("reviews.sourceTitle")}</h3>
        <span className="text-[11px] text-text-muted leading-snug max-w-md">{t("reviews.sourceNote")}</span>
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-text-muted mt-4">{t("reviews.sourceNone")}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border-t border-border-hairline pt-4 first:border-0 first:pt-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Stars value={r.rating} />
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-surface-secondary px-2 py-0.5 rounded">
                  <Store className="w-3 h-3" /> {t("reviews.sourceBadge")}
                </span>
                <span className="text-[11px] text-text-muted">
                  {r.source_name} · {r.author}
                  {r.review_date && ` · ${new Date(r.review_date).toLocaleDateString()}`}
                </span>
                {r.review_url && (
                  <a
                    href={r.review_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ms-auto inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
                  >
                    <ExternalLink className="w-3 h-3" /> {t("reviews.viewOriginal")}
                  </a>
                )}
              </div>
              <p className="text-sm text-text-muted leading-relaxed mt-1">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}