import React, { useCallback, useEffect, useState } from "react";
import { MessageSquareText, Save } from "lucide-react";
import { api } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_NOTICE =
  "VEYRO Marketplace — you are buying via VEYRO from an identified partner seller.";

// Configurable storefront copy. The notice shown on product pages and checkout
// lives as a SiteSetting record ("marketplace_notice"); empty value = default text.
export default function MarketplaceCopy() {
  const { toast } = useToast();
  const [value, setValue] = useState(DEFAULT_NOTICE);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.entities.SiteSetting.filter({ key: "marketplace_notice" }, null, 1);
      if (rows[0]) {
        setRecordId(rows[0].id);
        setValue(rows[0].value || DEFAULT_NOTICE);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        key: "marketplace_notice",
        value: value.trim() || DEFAULT_NOTICE,
        description: "Marketplace notice shown on product pages and checkout",
      };
      if (recordId) await api.entities.SiteSetting.update(recordId, payload);
      else {
        const created = await api.entities.SiteSetting.create(payload);
        setRecordId(created.id);
      }
      toast({ description: "Marketplace notice updated — live on the storefront." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
      <h3 className="font-display font-semibold text-sm flex items-center gap-2">
        <MessageSquareText className="w-4 h-4 text-accent-cyan" /> Marketplace copy
      </h3>
      <p className="text-xs text-text-muted mt-1">
        Notice shown on product pages and at checkout. Leave empty to restore the default text.
      </p>
      <div className="mt-3 flex flex-col md:flex-row gap-2">
        <textarea
          value={loading ? "…" : value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          className="flex-1 bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50"
          placeholder={DEFAULT_NOTICE}
        />
        <button
          onClick={save}
          disabled={saving || loading}
          className="self-start md:self-auto px-4 py-2 rounded-full bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}