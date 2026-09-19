import React, { useState } from "react";
import { Star, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Review form — create or edit. Purchase eligibility is enforced server-side
// (reviewSubmit): only real buyers can submit, verified_buyer never comes from
// the client.
export default function ReviewForm({ product, existing, photosEnabled, onDone }) {
  const { t } = useLang();
  const [rating, setRating] = useState(existing?.rating || 0);
  const [title, setTitle] = useState(existing?.title || "");
  const [text, setText] = useState(existing?.text || "");
  const [photos, setPhotos] = useState(existing?.photos || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 3 || busy) return;
    setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setPhotos((p) => [...p, file_url]);
    } catch (_e) {
      setError(t("common.error"));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!rating) return setError(t("reviews.yourRating"));
    if (!text.trim()) return setError(t("reviews.reviewText"));
    setBusy(true);
    try {
      await base44.functions.invoke("reviewSubmit", {
        product_id: product.id,
        rating,
        title,
        text,
        photos,
        review_id: existing?.id,
      });
      if (onDone) onDone();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-border-hairline bg-surface-primary p-4 space-y-3">
      <div>
        <div className="text-xs text-text-muted mb-1.5">{t("reviews.yourRating")}</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              aria-label={`${i} / 5`}
              className="no-tap-highlight"
            >
              <Star className={cn("w-6 h-6", i <= rating ? "fill-badge-premium text-badge-premium" : "text-border-hairline")} />
            </button>
          ))}
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("reviews.reviewTitle")}
        className="w-full px-3 py-2 rounded-lg border border-border-hairline text-sm bg-surface-card"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("reviews.reviewText")}
        rows={4}
        maxLength={2000}
        className="w-full px-3 py-2 rounded-lg border border-border-hairline text-sm bg-surface-card"
      />
      {photosEnabled && (
        <div className="flex items-center gap-2">
          {photos.map((p, i) => (
            <span key={i} className="relative">
              <img src={p} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-noon-fg text-white flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {photos.length < 3 && (
            <label className="px-3 py-2 rounded-lg border border-dashed border-border-hairline text-xs text-text-muted cursor-pointer hover:border-accent-cyan/40">
              {t("reviews.addPhotos")}
              <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
            </label>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
        >
          {existing ? t("reviews.update") : t("reviews.submit")}
        </button>
        <span className="text-[11px] text-text-muted">{t("reviews.moderationNote")}</span>
      </div>
    </form>
  );
}