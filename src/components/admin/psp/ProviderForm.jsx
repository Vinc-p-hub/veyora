import React, { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/api/client";

// Credential form for one provider. Values typed here are sent straight to the
// server; the page never reads them back.
export default function ProviderForm({ provider, onSaved }) {
  const [values, setValues] = useState({});
  const [mode, setMode] = useState(provider.mode || "TEST");
  const [enabled, setEnabled] = useState(!!provider.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const call = async (payload) => {
    setSaving(true);
    setError("");
    try {
      const res = await api.functions.invoke("pspCredentials", payload);
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      setValues({});
      onSaved?.(payload.action === "disconnect" ? `${provider.label} disconnected.` : `${provider.label} saved.`);
    } catch (e) {
      setError(e.response?.data?.error || "Saving failed.");
    } finally {
      setSaving(false);
    }
  };

  // Secrets-managed provider: live and read-only here.
  if (provider.managed_by === "secrets") {
    return (
      <div className="mt-3 border-t border-border-hairline pt-3 space-y-2">
        <p className="text-xs text-text-muted">
          Live and offered at checkout. Its keys are stored as app secrets rather than in this vault —
          rotate them from the app's Secrets settings.
        </p>
        {provider.fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">{f.label}</span>
            <span className="text-mono">{provider.hints?.[f.key] || "Not set"}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border-hairline pt-3 space-y-3">
      {provider.fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-[11px] text-text-muted">
            {f.label}
            {f.required ? "" : " (optional)"}
          </span>
          <input
            type={f.type === "secret" ? "password" : "text"}
            autoComplete="off"
            value={values[f.key] || ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={provider.hints?.[f.key] || "Not set"}
            className="mt-1 w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm"
          />
        </label>
      ))}

      <div className="flex items-center gap-3">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm"
        >
          <option value="TEST">TEST keys</option>
          <option value="LIVE">LIVE keys</option>
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Offer at checkout
        </label>
      </div>

      {error && <div className="text-xs text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <button
          onClick={() => call({ action: "save", provider: provider.id, mode, enabled, credentials: values })}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save keys"}
        </button>
        {provider.configured && (
          <button
            onClick={() => call({ action: "disconnect", provider: provider.id })}
            disabled={saving}
            title="Remove the stored keys"
            className="p-2.5 rounded-lg border border-border-hairline text-text-muted hover:text-destructive hover:border-destructive/40 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {provider.updated_by && (
        <p className="text-[10px] text-text-muted">Last saved by {provider.updated_by}</p>
      )}
    </div>
  );
}