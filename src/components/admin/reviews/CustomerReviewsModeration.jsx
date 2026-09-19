import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Flag, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import Stars from "@/components/reviews/Stars";

const STATUS_COLOR = {
  PENDING: "text-amber-600",
  APPROVED: "text-accent-cyan",
  PUBLISHED: "text-emerald-600",
  REJECTED: "text-red-600",
  HIDDEN: "text-text-muted",
};
const STATUSES = ["ALL", "PENDING", "APPROVED", "PUBLISHED", "REJECTED", "HIDDEN"];

// Customer review moderation queue — approve, publish, reject, hide, delete.
// Every action goes through reviewModerate and is audit-logged. A negative
// opinion is never a valid moderation reason.
export default function CustomerReviewsModeration() {
  const [reviews, setReviews] = useState(null);
  const [productNames, setProductNames] = useState({});
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyReported, setOnlyReported] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const list = await base44.entities.Review.list("-created_date", 200);
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
    let reason = "";
    if (action === "REJECT" || action === "HIDE") {
      reason = window.prompt(
        "Moderation reason (spam, advertising, illegal content, insult, off-topic, fake, manipulation, sensitive personal data). A negative opinion is NOT a valid reason:",
        ""
      );
      if (reason === null) return;
    }
    if (action === "DELETE" && !window.confirm("Permanently delete this review? This cannot be undone.")) return;
    setBusyId(review.id);
    try {
      await base44.functions.invoke("reviewModerate", { review_id: review.id, action, reason, scope: "customer" });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const qp = q.trim().toLowerCase();
    const qc = customer.trim().toLowerCase();
    return (reviews || []).filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (onlyVerified && !r.verified_buyer) return false;
      if (onlyReported && !r.reported) return false;
      if (qc && !(r.created_by || "").toLowerCase().includes(qc)) return false;
      if (qp) {
        const pn = productNames[r.product_id]?.name || "";
        if (!pn.toLowerCase().includes(qp) && !(r.product_slug || "").toLowerCase().includes(qp) && !(r.text || "").toLowerCase().includes(qp)) return false;
      }
      return true;
    });
  }, [reviews, status, q, customer, onlyVerified, onlyReported, productNames]);

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product, slug or review text…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-hairline text-xs"
          />
        </div>
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Customer email…"
          className="px-3 py-2 rounded-lg border border-border-hairline text-xs w-44"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-border-hairline text-xs">
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setOnlyVerified((v) => !v)}
          className={cn("px-3 py-2 rounded-lg border text-xs flex items-center gap-1.5", onlyVerified ? "border-accent-cyan text-accent-cyan" : "border-border-hairline")}
        >
          <BadgeCheck className="w-3.5 h-3.5" /> Verified Buyer
        </button>
        <button
          onClick={() => setOnlyReported((v) => !v)}
          className={cn("px-3 py-2 rounded-lg border text-xs flex items-center gap-1.5", onlyReported ? "border-red-400 text-red-600" : "border-border-hairline")}
        >
          <Flag className="w-3.5 h-3.5" /> Reported
        </button>
      </div>

      {reviews === null ? (
        <div className="h-24 rounded-lg animate-pulse bg-surface-primary" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted">No reviews match these filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const p = productNames[r.product_id];
            return (
              <div key={r.id} className="rounded-lg border border-border-hairline p-3.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("px-2 py-0.5 rounded border border-current/30 font-semibold", STATUS_COLOR[r.status])}>{r.status}</span>
                  <Stars value={r.rating} />
                  {r.verified_buyer && (
                    <span className="inline-flex items-center gap-1 text-accent-cyan font-semibold"><BadgeCheck className="w-3.5 h-3.5" /> Verified Buyer</span>
                  )}
                  {r.reported && (
                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><Flag className="w-3.5 h-3.5" /> {r.report_count} report(s)</span>
                  )}
                  {r.edit_count > 0 && <span className="text-text-muted">edited ×{r.edit_count}</span>}
                  <span className="text-text-muted ms-auto">{new Date(r.created_date).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">{r.created_by || "—"}</span>
                  {" reviewed "}
                  {p?.slug ? (
                    <Link to={`/product/${p.slug}`} className="text-accent-cyan hover:underline">{p.name || r.product_slug}</Link>
                  ) : (
                    <span className="text-text-muted">a removed product</span>
                  )}
                </div>
                {r.title && <div className="text-sm font-semibold mt-1">{r.title}</div>}
                <p className="text-sm text-text-muted mt-0.5">{r.text}</p>
                {(r.photos || []).length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {r.photos.map((ph, i) => <img key={i} src={ph} alt="" className="w-14 h-14 rounded object-cover border border-border-hairline" />)}
                  </div>
                )}
                {(r.flag_reason || r.moderation_reason) && (
                  <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                    {r.flag_reason && <>⚠ auto-flag: {r.flag_reason} </>}
                    {r.moderation_reason && <>· admin: {r.moderation_reason}</>}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {r.status !== "APPROVED" && r.status !== "PUBLISHED" && (
                    <ActionBtn disabled={busyId === r.id} onClick={() => moderate(r, "APPROVE")}>Approve</ActionBtn>
                  )}
                  {r.status !== "PUBLISHED" && (
                    <ActionBtn disabled={busyId === r.id} onClick={() => moderate(r, "PUBLISH")}>Publish</ActionBtn>
                  )}
                  {r.status !== "HIDDEN" ? (
                    <ActionBtn disabled={busyId === r.id} onClick={() => moderate(r, "HIDE")}>Hide</ActionBtn>
                  ) : (
                    <ActionBtn disabled={busyId === r.id} onClick={() => moderate(r, "RESTORE")}>Restore</ActionBtn>
                  )}
                  {r.status !== "REJECTED" && (
                    <ActionBtn disabled={busyId === r.id} onClick={() => moderate(r, "REJECT")} danger>Reject</ActionBtn>
                  )}
                  <ActionBtn disabled={busyId === r.id} onClick={() => moderate(r, "DELETE")} danger>Delete</ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, danger, ...props }) {
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