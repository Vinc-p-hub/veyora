import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

// Super Admin review switches — stored as SiteSetting records ("true"/"false").
// reviews_enabled gates the whole VEYRO customer review system,
// verified_buyer_enabled gates the Verified Buyer badge display,
// review_photos_enabled gates photo uploads in reviews.
const SETTINGS = [
  { key: "reviews_enabled", label: "VEYRO customer reviews", desc: "Verified buyers can review products they purchased" },
  { key: "verified_buyer_enabled", label: "Verified Buyer badge", desc: "Display the “Verified Buyer” badge on reviews with a confirmed purchase" },
  { key: "review_photos_enabled", label: "Photos in reviews", desc: "Allow customers to attach up to 3 photos to their review" },
];

export default function ReviewsSettings({ onChanged }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const list = await base44.entities.SiteSetting.list(null, 100);
    setRows(list);
  };

  React.useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  const valueOf = (key) => {
    const row = (rows || []).find((r) => r.key === key);
    return row ? row.value : "true";
  };

  const toggle = async (s) => {
    setBusy(true);
    const next = valueOf(s.key) === "true" ? "false" : "true";
    const row = (rows || []).find((r) => r.key === s.key);
    if (row) await base44.entities.SiteSetting.update(row.id, { value: next });
    else await base44.entities.SiteSetting.create({ key: s.key, value: next, description: s.desc });
    await load();
    setBusy(false);
    if (onChanged) onChanged();
  };

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <h3 className="font-display font-semibold mb-1">Review system settings</h3>
      <p className="text-xs text-text-muted mb-4">
        Absolute rule: no fake reviews, no fake Verified Buyer, no artificially generated reviews.
      </p>
      {rows === null ? (
        <div className="h-16 rounded-lg animate-pulse bg-surface-primary" />
      ) : (
        <div className="grid md:grid-cols-3 gap-3">
          {SETTINGS.map((s) => {
            const on = valueOf(s.key) === "true";
            return (
              <div key={s.key} className="rounded-lg border border-border-hairline p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{s.label}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{s.desc}</div>
                  </div>
                  <button
                    onClick={() => toggle(s)}
                    disabled={busy}
                    className={cn(
                      "shrink-0 w-11 h-6 rounded-full relative transition disabled:opacity-40",
                      on ? "bg-accent-cyan" : "bg-border-hairline"
                    )}
                    aria-label={`${s.label}: ${on ? "on" : "off"}`}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                        on ? "left-[22px]" : "left-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}