import React, { useState } from "react";
import { Calculator } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice, PLAN_OPTIONS, buildInstallmentPlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export default function FinancingCalculator() {
  const { t } = useLang();
  const { currency } = useRegion();
  const [amount, setAmount] = useState(1000);
  const [planId, setPlanId] = useState("plan_5");

  const opt = PLAN_OPTIONS.find((o) => o.id === planId) || PLAN_OPTIONS[3];
  const plan = buildInstallmentPlan(amount, opt.installments, opt.downPercent);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl flex items-center gap-2">
          <Calculator className="w-6 h-6 text-accent-cyan" /> {t("calc.title")}
        </h1>
        <p className="text-sm text-text-muted mt-1">{t("calc.sub")}</p>
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-xl p-5 space-y-5">
        {/* Price input */}
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("calc.priceLabel")} ({currency.code})</span>
          <input
            type="number" min="1" step="0.01" value={amount}
            onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
            className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-4 py-3 font-display font-bold text-xl focus:outline-none focus:border-accent-cyan/50"
          />
          <div className="flex gap-2 mt-2">
            {[300, 500, 1000, 2000].map((v) => (
              <button key={v} onClick={() => setAmount(v)}
                className="px-3 py-1.5 rounded-lg bg-surface-primary border border-border-hairline text-xs hover:border-accent-cyan/40">
                {formatPrice(v, currency)}
              </button>
            ))}
          </div>
        </label>

        {/* Plan choice */}
        <div>
          <span className="text-[10px] uppercase tracking-widest text-text-muted">{t("calc.choosePlan")}</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            {PLAN_OPTIONS.map((o) => (
              <button key={o.id} onClick={() => setPlanId(o.id)}
                className={cn(
                  "px-3 py-2.5 rounded-lg border text-sm transition text-left",
                  planId === o.id ? "border-accent-cyan bg-accent-cyan/5" : "border-border-hairline text-text-muted hover:text-text-primary"
                )}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-surface-primary p-4 space-y-2.5">
          {plan.installmentCount === 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">{t("calc.payToday")}</span>
              <span className="text-mono font-semibold text-accent-cyan">{formatPrice(plan.totalPaid, currency)}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{t("calc.downPayment")}</span>
                <span className="text-mono font-semibold text-accent-cyan">{formatPrice(plan.downPayment, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{t("calc.thenMonthly", { n: plan.installmentCount })}</span>
                <span className="text-mono font-semibold">{formatPrice(plan.installmentAmount, currency)}{t("card.perMonth")}</span>
              </div>
            </>
          )}
          <div className="border-t border-border-hairline pt-2.5 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-text-muted">{t("calc.totalPaid")}</span>
            <span className="text-mono font-bold">{formatPrice(plan.totalPaid, currency)}</span>
          </div>
        </div>

        {/* Schedule */}
        {plan.installmentCount > 0 && (
          <div>
            <h2 className="font-display font-semibold text-sm mb-2">{t("calc.schedule")}</h2>
            <div className="rounded-lg border border-border-hairline overflow-hidden">
              <div className="grid grid-cols-2 bg-surface-secondary text-[10px] uppercase tracking-widest text-text-muted px-4 py-2">
                <span>{t("calc.month")}</span>
                <span className="text-right">{t("calc.amount")}</span>
              </div>
              <div className="grid grid-cols-2 px-4 py-2.5 text-sm bg-surface-card border-b border-border-hairline">
                <span className="text-text-muted">{t("calc.payToday")}</span>
                <span className="text-right text-mono font-semibold text-accent-cyan">{formatPrice(plan.downPayment, currency)}</span>
              </div>
              {Array.from({ length: plan.installmentCount }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 px-4 py-2.5 text-sm bg-surface-card border-b border-border-hairline last:border-0">
                  <span className="text-text-muted">{i + 1} · {new Date(Date.now() + (i + 1) * 30 * 86400000).toLocaleDateString()}</span>
                  <span className="text-right text-mono">{formatPrice(plan.installmentAmount, currency)}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 px-4 py-2.5 text-sm bg-surface-secondary font-semibold">
                <span>{t("calc.totalPaid")}</span>
                <span className="text-right text-mono">{formatPrice(plan.totalPaid, currency)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}