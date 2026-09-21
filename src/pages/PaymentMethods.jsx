import React, { useEffect, useState } from "react";
import { CreditCard, ShieldCheck, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PAYMENT_PROVIDERS, ACTIVE_PROVIDERS } from "@/lib/countries";
import { useLang } from "@/lib/i18n";
import { useRegion } from "@/lib/RegionContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function PaymentMethods() {
  const { t } = useLang();
  const { country } = useRegion();
  const { toast } = useToast();
  const [preferred, setPreferred] = useState(null);

  useEffect(() => {
    base44.auth.me().then((me) => setPreferred(me.preferred_payment_provider || null)).catch(() => {});
  }, []);

  const setAsPreferred = async (id) => {
    await base44.auth.updateMe({ preferred_payment_provider: id });
    setPreferred(id);
    toast({ description: t("payment.preferredSet") });
  };

  const available = ACTIVE_PROVIDERS.map((p) => PAYMENT_PROVIDERS[p]).filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl md:text-3xl">{t("payment.title")}</h1>
        <p className="text-xs text-text-muted mt-1">{t("payment.sub")}</p>
      </div>

      <div className="bg-surface-card border border-border-hairline rounded-xl p-5 space-y-3">
        <h2 className="font-display font-semibold">{t("payment.available")} — {country.flag} {country.name}</h2>
        {available.map((p) => (
          <div key={p.id} className={cn(
            "flex items-center gap-4 rounded-lg p-4 border",
            preferred === p.id ? "border-accent-cyan bg-accent-cyan/5" : "border-border-hairline bg-surface-primary"
          )}>
            <div className="w-10 h-10 rounded-lg bg-white border border-border-hairline flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2">{p.name} <span className="text-[9px] uppercase tracking-widest bg-noon text-noon-fg px-1.5 py-0.5 rounded">{p.badge}</span></div>
              <div className="text-xs text-text-muted mt-0.5">{p.desc}</div>
            </div>
            {preferred === p.id ? (
              <span className="text-xs font-semibold text-accent-cyan flex items-center gap-1"><Check className="w-4 h-4" />{t("payment.preferred")}</span>
            ) : (
              <button onClick={() => setAsPreferred(p.id)} className="px-3 py-1.5 rounded-lg border border-border-hairline text-xs font-medium hover:border-accent-cyan/40">
                {t("payment.setPreferred")}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-surface-card border border-border-hairline p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted leading-relaxed">{t("payment.security")}</p>
      </div>
    </div>
  );
}