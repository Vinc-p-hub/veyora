import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { api } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import ProviderCard from "@/components/admin/psp/ProviderCard";
import { invalidateConnectedProviders } from "@/lib/useConnectedProviders";

// Back-office credential vault. Keys are stored server-side and never travel
// back to this page — only a masked preview of each saved value is shown.
export default function PaymentProviders() {
  const { toast } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.functions.invoke("pspCredentials", { action: "list" });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setError("");
        setProviders(res.data?.providers || []);
      }
    } catch (e) {
      setError(e.response?.data?.error || "Could not load the payment providers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connected = providers.filter((p) => p.configured).length;

  const onSaved = (message) => {
    toast({ description: message });
    invalidateConnectedProviders();
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent-cyan" /> Payment providers
        </h1>
        <p className="text-xs text-text-muted mt-1">
          {connected} of {providers.length} connected · keys are stored server-side and shown masked only.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {loading ? (
        <div className="h-40 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              open={openId === p.id}
              onToggle={() => setOpenId((id) => (id === p.id ? null : p.id))}
              onSaved={onSaved}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-text-muted flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 text-accent-cyan" />
        Saved keys are never readable from the browser. Entering a value replaces it; leaving a field empty keeps the one already stored.
      </p>
    </div>
  );
}