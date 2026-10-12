import React from "react";
import { Link } from "react-router-dom";
import { Calculator, Check, Globe } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice, PLAN_OPTIONS, buildInstallmentPlan } from "@/lib/pricing";

const EXAMPLE_USD = 1000;

export default function FinancingInfo() {
  const { t } = useLang();
  const { currency, country } = useRegion();

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl">{t("financing.title")}</h1>
        <p className="text-sm text-text-muted mt-1">{t("financing.sub")}</p>
      </div>

      {/* How it works */}
      <div className="bg-noon rounded-xl p-6 text-noon-fg space-y-3">
        <h2 className="font-display font-bold text-lg">{t("financing.howTitle")}</h2>
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-start gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-noon-fg text-noon flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">{n}</span>
            <p>{t(`financing.how${n}`)}</p>
          </div>
        ))}
      </div>

      {/* Plan examples on a real price */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5">
        <h2 className="font-display font-semibold mb-1">{t("financing.viewPlans")}</h2>
        <p className="text-xs text-text-muted mb-4">{t("calc.priceLabel")}: {formatPrice(EXAMPLE_USD, currency)}</p>
        <div className="grid md:grid-cols-2 gap-3">
          {PLAN_OPTIONS.map((opt) => {
            const plan = buildInstallmentPlan(EXAMPLE_USD, opt.installments, opt.downPercent);
            return (
              <div key={opt.id} className="rounded-lg bg-surface-primary border border-border-hairline p-4">
                <div className="font-semibold text-sm">{opt.label}</div>
                {plan.installmentCount === 0 ? (
                  <div className="text-xs text-text-muted mt-1.5">{t("calc.payToday")}: <span className="text-text-primary font-semibold">{formatPrice(plan.totalPaid, currency)}</span></div>
                ) : (
                  <div className="text-xs text-text-muted mt-1.5 space-y-0.5">
                    <div>{t("calc.downPayment")}: <span className="text-text-primary font-semibold">{formatPrice(plan.downPayment, currency)}</span></div>
                    <div>{t("calc.thenMonthly", { n: plan.installmentCount })}: <span className="text-text-primary font-semibold">{formatPrice(plan.installmentAmount, currency)}{t("card.perMonth")}</span></div>
                  </div>
                )}
                <div className="text-xs mt-2 pt-2 border-t border-border-hairline flex items-center gap-1 font-semibold text-accent-cyan">
                  <Check className="w-3.5 h-3.5" /> {t("calc.totalPaid")}: {formatPrice(plan.totalPaid, currency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total transparency */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5">
        <h2 className="font-display font-semibold">{t("financing.totalTitle")}</h2>
        <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{t("financing.totalSub")}</p>
      </div>

      {/* Eligibility */}
      <div className="bg-surface-card border border-border-hairline rounded-xl p-5">
        <h2 className="font-display font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-accent-cyan" />{t("financing.eligibilityTitle")}</h2>
        <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
          {t("financing.eligibilitySub")} <span className="text-text-primary font-medium">{country.flag} {country.name}</span>
        </p>
      </div>

      <Link to="/financing-calculator" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-noon-fg text-white text-sm font-semibold hover:opacity-90">
        <Calculator className="w-4 h-4" /> {t("financing.tryCalculator")}
      </Link>
    </div>
  );
}