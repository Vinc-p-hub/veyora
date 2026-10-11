import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Circle, ExternalLink, Loader2, ShieldCheck, Zap } from "lucide-react";
import { api } from "@/api/client";
import { supabaseUrl } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { invalidateConnectedProviders } from "@/lib/useConnectedProviders";

// Back-office PSP vault. Paste your keys, press "Save & test": the server checks them with the
// provider before storing them encrypted. Keys never come back to the browser (masked hints only).
// All connected providers are embedded in the checkout — customers never leave the page.

function ProviderCard({ p, onChanged }) {
  const { toast } = useToast();
  const [mode, setMode] = useState(p.mode || "TEST");
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const call = async (action, extra = {}) => {
    setBusy(action);
    setError("");
    try {
      const res = await api.functions.invoke("payments", { action, provider: p.id, ...extra });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    } catch (e) {
      setError(e.message || "Request failed");
      return null;
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    const d = await call("admin_save", { mode, enabled: true, credentials: values });
    if (d?.ok) {
      setValues({});
      toast({ description: `${p.label} connected and enabled — customers can now pay with it.` });
      onChanged();
    }
  };
  const test = async () => {
    const d = await call("admin_test");
    if (d?.ok) toast({ description: `${p.label}: connection OK` });
  };
  const toggle = async () => {
    const d = await call("admin_toggle", { enabled: !p.enabled });
    if (d?.ok) onChanged();
  };
  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${p.label}? Its keys will be erased.`)) return;
    const d = await call("admin_disconnect");
    if (d?.ok) onChanged();
  };

  const missingRequired = p.fields.some((f) => f.required && !values[f.key] && !p.hints[f.key]);

  return (
    <div className="rounded-lg border border-border-hairline bg-surface-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold flex items-center gap-2">
            {p.label}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-secondary text-text-muted">{p.region}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 inline-flex items-center gap-1"><Zap className="w-3 h-3" /> No redirect</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{p.desc}</p>
        </div>
        <div className="flex items-center gap-3">
          {p.configured ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-4 h-4" /> Connected · {p.mode}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted"><Circle className="w-4 h-4" /> Not connected</span>
          )}
          {p.configured && (
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={p.enabled} onChange={toggle} disabled={!!busy} />
              {p.enabled ? "Live on checkout" : "Hidden"}
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {["TEST", "LIVE"].map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border ${mode === m ? "bg-noon text-noon-fg border-transparent" : "border-border-hairline text-text-muted"}`}>
            {m === "TEST" ? "Test / sandbox" : "Live"}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {p.fields.map((f) => (
          <label key={f.key} className="block text-xs">
            <span className="font-medium">{f.label}{f.required ? "" : " (optional)"}</span>
            <input
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              value={values[f.key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={p.hints[f.key] ? `${p.hints[f.key]} — leave blank to keep` : f.placeholder || ""}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border-hairline bg-surface-primary text-sm text-mono"
            />
          </label>
        ))}
      </div>

      {p.id === "stripe" && (
        <p className="text-xs text-text-muted">
          Webhook (recommended, confirms payments even if the customer closes the tab): in Stripe → Developers → Webhooks add
          the endpoint <code className="text-mono select-all">{supabaseUrl}/functions/v1/payments</code> with
          events <code>payment_intent.succeeded</code> and <code>payment_intent.payment_failed</code>, then paste the signing secret above.
        </p>
      )}

      {error && <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={!!busy || missingRequired}
          className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-2">
          {busy === "admin_save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          Save & test connection
        </button>
        {p.configured && (
          <>
            <button onClick={test} disabled={!!busy} className="px-3 py-2 rounded-lg border border-border-hairline text-xs">
              {busy === "admin_test" ? "Testing…" : "Test again"}
            </button>
            <button onClick={disconnect} disabled={!!busy} className="px-3 py-2 rounded-lg text-xs text-destructive">Disconnect</button>
          </>
        )}
        <a href={p.docs} target="_blank" rel="noreferrer" className="ml-auto text-xs underline inline-flex items-center gap-1">
          Get your keys <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function PaymentProviders() {
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.functions.invoke("payments", { action: "admin_list" });
      setProviders(res.data?.providers || []);
      setError("");
      invalidateConnectedProviders();
    } catch (e) {
      setError(e.message || "Could not load the payment providers.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const live = (providers || []).filter((p) => p.configured && p.enabled).length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent-cyan" /> Payment providers
        </h1>
        <p className="text-xs text-text-muted mt-1">
          {providers ? `${live} live on checkout · ` : ""}Keys are verified with the provider, then stored encrypted server-side and never shown again.
        </p>
      </div>
      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      {!providers && !error && <div className="h-40 bg-surface-card rounded-lg animate-pulse" />}
      {(providers || []).map((p) => <ProviderCard key={p.id} p={p} onChanged={load} />)}
    </div>
  );
}
