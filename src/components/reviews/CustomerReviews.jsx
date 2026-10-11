import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Flag, Pencil, PenLine, UserCheck } from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/i18n";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";
import Stars from "./Stars";
import ReviewForm from "./ReviewForm";

// VEYRO customer reviews — real reviews from real buyers only. The Verified
// Buyer badge is granted server-side after purchase confirmation; the section
// is fully separate from imported source reviews.
const ELIGIBLE_STATUS = ["PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED"];

export default function CustomerReviews({ product }) {
  const { t } = useLang();
  const { user } = useAuth();
  const [reviews, setReviews] = useState(null);
  const [ownReview, setOwnReview] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [settings, setSettings] = useState({ reviews: true, verified: true, photos: true });
  const [showForm, setShowForm] = useState(false);
  const [reported, setReported] = useState(null);

  const load = useCallback(() => {
    let live = true;
    setReviews(null);
    setOwnReview(null);
    setEligible(false);
    setShowForm(false);
    api.entities.SiteSetting.list(null, 100)
      .then((rows) => {
        if (!live) return;
        const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
        setSettings({
          reviews: (map.reviews_enabled ?? "true") === "true",
          verified: (map.verified_buyer_enabled ?? "true") === "true",
          photos: (map.review_photos_enabled ?? "true") === "true",
        });
      })
      .catch(() => {});
    api.entities.Review.filter({ product_id: product.id, status: "PUBLISHED" }, "-created_date", 50)
      .then((rows) => live && setReviews(rows))
      .catch(() => live && setReviews([]));
    if (!user) return;
    api.functions.invoke("payments", { action: "my_orders" })
      .then((res) => {
        if (!live) return;
        const orders = res.data?.orders || [];
        setEligible(
          orders.some(
            (o) => ELIGIBLE_STATUS.includes(o.status) && (o.items || []).some((it) => (it.product_id || it.id) === product.id)
          )
        );
      })
      .catch(() => {});
    // Customer-service invitation also unlocks review writing (no purchase needed).
    api.entities.ReviewInvitation.filter({ email: (user.email || "").toLowerCase(), product_id: product.id, status: "PENDING" })
      .then((rows) => live && rows.length > 0 && setEligible(true))
      .catch(() => {});
    // Own review in any status (PENDING / PUBLISHED / HIDDEN…) — read rule allows the author.
    api.entities.Review.filter({ product_id: product.id }, "-created_date", 50)
      .then((rows) => live && setOwnReview(rows.find((r) => r.created_by_id === user.id) || null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [product?.id, user?.id]);

  useEffect(load, [load]);

  const report = async (id) => {
    try {
      await api.functions.invoke("reviewReport", { review_id: id });
      setReported(id);
    } catch (_e) {
      /* reported state untouched */
    }
  };

  if (reviews === null || !settings.reviews) return null;

  const avg = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;
  const canEdit = ownReview && ownReview.status !== "REJECTED";

  return (
    <section className="bg-surface-card border border-border-hairline rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-bold text-lg">{t("reviews.customerTitle")}</h3>
          {avg && (
            <span className="flex items-center gap-1.5 text-sm text-text-muted">
              <Stars value={Number(avg)} /> {avg} · {t("reviews.basedOn", { n: reviews.length })}
            </span>
          )}
        </div>
        {eligible && !ownReview && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 flex items-center gap-2"
          >
            <PenLine className="w-4 h-4" /> {t("reviews.write")}
          </button>
        )}
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-medium hover:border-accent-cyan/40 flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" /> {t("reviews.edit")}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4">
          <ReviewForm
            product={product}
            existing={ownReview}
            photosEnabled={settings.photos}
            onDone={load}
          />
        </div>
      )}

      {ownReview && !showForm && ownReview.status !== "PUBLISHED" && (
        <p className="mt-3 rounded-lg bg-surface-primary p-3 text-xs text-text-muted">
          {t("reviews.pending")}
          {ownReview.status === "REJECTED" && ` — ${t("reviews.rejectedNote")}`}
        </p>
      )}
      {user && !eligible && !ownReview && (
        <p className="mt-3 text-xs text-text-muted">{t("reviews.purchaseRequired")}</p>
      )}

      <div className="mt-4 space-y-4">
        {reviews.length === 0 && !ownReview && !eligible && (
          <p className="text-sm text-text-muted">{t("reviews.none")}</p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="border-t border-border-hairline pt-4 first:border-0 first:pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Stars value={r.rating} />
              {settings.verified && r.verified_buyer && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent-cyan">
                  <BadgeCheck className="w-3.5 h-3.5" /> {t("reviews.verified")}
                </span>
              )}
              {!r.verified_buyer && r.invited_buyer && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  <UserCheck className="w-3.5 h-3.5" /> {t("reviews.invited")}
                </span>
              )}
              <span className="text-[11px] text-text-muted ms-auto">
                {r.created_date ? new Date(r.created_date).toLocaleDateString() : ""}
              </span>
            </div>
            {r.title && <div className="text-sm font-semibold mt-1.5">{r.title}</div>}
            <p className="text-sm text-text-muted leading-relaxed mt-1">{r.text}</p>
            {(r.photos || []).length > 0 && (
              <div className="flex gap-2 mt-2">
                {r.photos.map((p, i) => (
                  <Image key={i} src={p} className="w-20 h-20 rounded-lg border border-border-hairline" />
                ))}
              </div>
            )}
            {user && r.created_by_id !== user.id && (
              <button
                onClick={() => report(r.id)}
                disabled={reported === r.id}
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary disabled:opacity-50"
                )}
              >
                <Flag className="w-3 h-3" /> {reported === r.id ? t("reviews.reportDone") : t("reviews.report")}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}