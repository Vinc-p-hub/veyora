import React, { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import Stars from "@/components/reviews/Stars";

// Manual entry of a REAL partner review — the staff member pastes the review
// verbatim from the partner site (text, author, rating, original URL). The
// review is stored as a SourceReview tied to its source. Nothing is ever
// generated or rewritten here.
export default function ManualSourceReviewForm({ onCreated, productId: lockedProductId = "", productName: lockedProductName = "" }) {
  const locked = !!lockedProductId;
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [sources, setSources] = useState([]);
  const [productId, setProductId] = useState(lockedProductId);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Opened from a product page: the product is fixed, so no catalog is loaded.
    if (!locked) {
      base44.entities.Product.filter({ status: "PUBLISHED" }, "name", 500)
        .then((list) => setProducts(list))
        .catch(() => {});
    }
    base44.entities.CrawlerSource.list("name", 100)
      .then((list) => setSources(list.filter((s) => s.enabled)))
      .catch(() => {});
  }, [locked]);

  const matches = useMemo(() => {
    const qp = query.trim().toLowerCase();
    if (!qp) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(qp) || (p.brand || "").toLowerCase().includes(qp))
      .slice(0, 6);
  }, [products, query]);

  const selected = locked ? { id: lockedProductId, name: lockedProductName } : products.find((p) => p.id === productId);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!productId) return setError("Select the product this review belongs to.");
    if (!text.trim()) return setError("Paste the full original review text — verbatim.");
    if (!sourceName.trim()) return setError("Indicate the partner source the review comes from.");
    setSaving(true);
    try {
      const source = sources.find((s) => s.name === sourceName);
      await base44.entities.SourceReview.create({
        product_id: productId,
        source_id: source?.id || "",
        source_name: sourceName.trim(),
        author: author.trim() || "Anonymous",
        rating: Math.max(1, Math.min(5, Number(rating) || 5)),
        text: text.trim(),
        review_date: reviewDate || null,
        review_url: reviewUrl.trim() || null,
        status: "ACTIVE",
        imported_at: new Date().toISOString(),
      });
      setProductId(lockedProductId); setQuery(""); setRating(5); setText("");
      setAuthor(""); setSourceName(""); setReviewDate(""); setReviewUrl("");
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-noon text-noon-fg text-xs font-semibold hover:opacity-90 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Add partner review
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-lg border border-accent-cyan/40 bg-surface-primary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Add a real partner review (verbatim)</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
      </div>

      {/* Product picker — locked when the form is opened from a product page */}
      <div className="relative">
        {locked ? (
          <div className="w-full px-3 py-2 rounded-lg border border-border-hairline bg-surface-card text-xs">
            On <span className="font-medium">{lockedProductName}</span>
          </div>
        ) : (
          <>
            <input
              value={selected ? selected.name : query}
              onChange={(e) => { setProductId(""); setQuery(e.target.value); }}
              placeholder="Search the product…"
              className="w-full px-3 py-2 rounded-lg border border-border-hairline text-xs"
            />
            {query && !selected && matches.length > 0 && (
              <div className="absolute z-10 inset-x-0 top-full mt-1 rounded-lg border border-border-hairline bg-white shadow-lg max-h-48 overflow-auto">
                {matches.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => { setProductId(p.id); setQuery(p.name); }}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-surface-primary"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-text-muted"> · {p.brand}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Rating + author + date */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <Stars value={rating} />
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="px-2 py-1 rounded-md border border-border-hairline text-xs">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </select>
        </div>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Original author name" className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-border-hairline text-xs" />
        <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="px-3 py-2 rounded-lg border border-border-hairline text-xs" />
      </div>

      {/* Source + URL */}
      <div className="flex flex-wrap gap-3">
        <input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          list="partner-sources"
          placeholder="Partner source (e.g. Keychron, Al Ershad…)"
          className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-border-hairline text-xs"
        />
        <datalist id="partner-sources">
          {sources.map((s) => <option key={s.id} value={s.name} />)}
        </datalist>
        <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="Original review URL (optional)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-border-hairline text-xs" />
      </div>

      {/* Verbatim text */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the review text EXACTLY as published on the partner site — never rewrite, translate or invent it."
        rows={4}
        className="w-full px-3 py-2 rounded-lg border border-border-hairline text-xs"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className={cn("px-4 py-2 rounded-lg bg-noon text-noon-fg text-xs font-semibold hover:opacity-90 transition", saving && "opacity-50")}
        >
          {saving ? "Saving…" : "Publish review"}
        </button>
        <p className="text-[10px] text-text-muted">The review appears instantly in the “Source reviews” section of the product page, labeled with its partner source.</p>
      </div>
    </form>
  );
}