import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Chip, Field } from "./Field";
import { EMPTY_PROMO, INPUT, toFormState, toRecord } from "./promoForm";
import PromoRuleFields from "./PromoRuleFields";
import PromoTargetFields from "./PromoTargetFields";

export default function PromotionForm({ initial, onClose, onSave }) {
  const [f, setF] = useState(toFormState(EMPTY_PROMO));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) { setF(toFormState(initial)); setError(""); }
  }, [initial]);

  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  const submit = async () => {
    if (!f.name.trim()) return setError("Campaign name is required.");
    if (f.kind === "COUPON" && !f.code.trim()) return setError("A coupon needs a code.");
    if (f.discount_type !== "FREE_SHIPPING" && !(Number(f.value) > 0)) return setError("Discount value must be above 0.");
    setSaving(true);
    setError("");
    try {
      await onSave(toRecord(f));
    } catch (e) {
      setError(e.message || "Save failed.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!initial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit promotion" : "New promotion"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Chip on={f.kind === "AUTOMATIC"} onClick={() => set({ kind: "AUTOMATIC" })}>Automatic (on prices)</Chip>
            <Chip on={f.kind === "COUPON"} onClick={() => set({ kind: "COUPON" })}>Coupon code</Chip>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Campaign name"><input className={INPUT} value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            {f.kind === "COUPON"
              ? <Field label="Code"><input className={`${INPUT} uppercase text-mono`} value={f.code} onChange={(e) => set({ code: e.target.value })} /></Field>
              : <Field label="Badge shown to customers"><input className={INPUT} value={f.label} placeholder="FLASH -15%" onChange={(e) => set({ label: e.target.value })} /></Field>}
          </div>
          <PromoRuleFields f={f} set={set} />
          <PromoTargetFields f={f} set={set} />
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => set({ active: v })} /> Active</label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-full border border-border-hairline text-sm">Cancel</button>
            <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-full bg-noon text-noon-fg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save promotion
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}