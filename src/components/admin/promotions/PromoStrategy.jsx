import React from "react";
import { PLAYBOOK } from "./playbook";

export default function PromoStrategy({ onUse }) {
  return (
    <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
      <h2 className="font-display font-semibold text-lg">Promotion playbook</h2>
      <p className="text-xs text-text-muted mt-0.5 mb-4">
        Pick a proven campaign, adjust it, then save. Automatic discounts never drop a price below the
        supplier cost — the server enforces it on every order.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLAYBOOK.map((p) => (
          <button
            key={p.title}
            onClick={() => onUse(p.build())}
            className="text-left p-4 rounded-lg border border-border-hairline hover:border-accent-cyan/50 hover:bg-surface-primary transition"
          >
            <div className="flex items-center gap-2">
              <p.icon className="w-4 h-4 text-accent-cyan" />
              <span className="text-[10px] uppercase tracking-wider text-text-muted">{p.goal}</span>
            </div>
            <div className="font-semibold text-sm mt-2">{p.title}</div>
            <p className="text-xs text-text-muted mt-1 leading-snug">{p.tip}</p>
          </button>
        ))}
      </div>
    </section>
  );
}