import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { invalidateConnectedProviders } from "@/lib/useConnectedProviders";

// PayPal is configured with Supabase Edge Function secrets (never stored in the browser or the database).
export default function PaymentProviders() {
  const [configured, setConfigured] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setConfigured(null);
    setError("");
    try {
      const res = await api.functions.invoke("paypal", { action: "providers" });
      setConfigured((res.data?.providers || []).some((p) => p.id === "paypal"));
      invalidateConnectedProviders();
    } catch (e) {
      setError(e.message || "Could not check PayPal.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-accent-cyan" /> Payment providers
      </h1>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-lg border border-border-hairline p-4 bg-surface-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">PayPal Checkout</div>
          {configured === null ? (
            <span className="text-xs text-text-muted animate-pulse">Checking…</span>
          ) : configured ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-4 h-4" /> Connected</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-4 h-4" /> Not configured</span>
          )}
        </div>
        {configured === false && (
          <ol className="text-sm text-text-muted list-decimal pl-5 space-y-1">
            <li>Create a REST app at developer.paypal.com and copy the Client ID and Secret.</li>
            <li>In Supabase → Edge Functions → Secrets add <code>PAYPAL_CLIENT_ID</code>, <code>PAYPAL_CLIENT_SECRET</code> and <code>PAYPAL_ENV</code> (<code>sandbox</code> or <code>live</code>).</li>
            <li>Come back here and refresh.</li>
          </ol>
        )}
        <button onClick={load} className="inline-flex items-center gap-1.5 text-xs underline">
          <RefreshCw className="w-3 h-3" /> Refresh status
        </button>
      </div>
    </div>
  );
}
