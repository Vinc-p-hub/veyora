import React, { useState } from "react";
import { Star } from "lucide-react";
import ReviewsSettings from "@/components/admin/reviews/ReviewsSettings";
import CustomerReviewsModeration from "@/components/admin/reviews/CustomerReviewsModeration";
import SourceReviewsAdmin from "@/components/admin/reviews/SourceReviewsAdmin";
import ModerationLogPanel from "@/components/admin/reviews/ModerationLogPanel";
import InviteBuyersPanel from "@/components/admin/reviews/InviteBuyersPanel";
import BulkReviewImport from "@/components/admin/reviews/BulkReviewImport";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "customer", label: "Customer reviews" },
  { id: "invite", label: "Invite buyers" },
  { id: "source", label: "Source reviews" },
  { id: "import", label: "Import file" },
  { id: "log", label: "Moderation log" },
];

export default function ReviewsAdmin() {
  const [tab, setTab] = useState("customer");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl flex items-center gap-2">
          <Star className="w-5 h-5 text-badge-premium" /> Reviews management
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Customer reviews (verified buyers only, statuses PENDING → APPROVED → PUBLISHED or PENDING → REJECTED) and
          verbatim imported source reviews stay separate. No fake reviews, no fake Verified Buyer, no generated content.
        </p>
      </div>
      <ReviewsSettings />
      <div className="flex gap-2">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition",
              tab === tb.id ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5" : "border-border-hairline text-text-muted hover:text-text-primary"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>
      {tab === "customer" && <CustomerReviewsModeration />}
      {tab === "invite" && <InviteBuyersPanel />}
      {tab === "source" && <SourceReviewsAdmin />}
      {tab === "import" && <BulkReviewImport />}
      {tab === "log" && <ModerationLogPanel />}
    </div>
  );
}