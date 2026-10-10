import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/api/client";
import { promoStatus } from "@/lib/promotions";
import PromoStrategy from "@/components/admin/promotions/PromoStrategy";
import PromotionRow from "@/components/admin/promotions/PromotionRow";
import PromotionForm from "@/components/admin/promotions/PromotionForm";
import { EMPTY_PROMO } from "@/components/admin/promotions/promoForm";

export default function Promotions() {
  const [promos, setPromos] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, object = new/edit

  const load = () => api.entities.Promotion.list("-created_date", 200).then(setPromos);
  useEffect(() => { load(); }, []);

  const save = async (record) => {
    const duplicate = record.kind === "COUPON" && (promos || []).some(
      (p) => p.id !== editing.id && p.kind === "COUPON" && String(p.code || "").toUpperCase() === record.code
    );
    if (duplicate) throw new Error("This coupon code already exists.");
    if (editing.id) await api.entities.Promotion.update(editing.id, record);
    else await api.entities.Promotion.create({ ...record, usage_count: 0 });
    setEditing(null);
    await load();
  };
  const toggle = async (p) => { await api.entities.Promotion.update(p.id, { active: !p.active }); load(); };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    await api.entities.Promotion.delete(p.id);
    load();
  };

  const list = promos || [];
  const live = list.filter((p) => promoStatus(p) === "LIVE").length;
  const stats = [
    ["Live now", live],
    ["Scheduled", list.filter((p) => promoStatus(p) === "SCHEDULED").length],
    ["Coupon codes", list.filter((p) => p.kind === "COUPON").length],
    ["Orders with a promo", list.reduce((s, p) => s + (p.usage_count || 0), 0)],
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl">Promotions</h1>
          <p className="text-sm text-text-muted">Automatic price discounts, coupon codes and free shipping — applied and verified server-side on every order.</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY_PROMO })} className="px-4 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> New promotion
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface-card border border-border-hairline rounded-lg p-4">
            <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
            <div className="font-display font-bold text-2xl mt-1">{promos ? value : "…"}</div>
          </div>
        ))}
      </div>
      <PromoStrategy onUse={setEditing} />
      <section className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
        {promos === null ? (
          <div className="p-6 text-sm text-text-muted">Loading promotions…</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">No promotion yet — start from the playbook above.</div>
        ) : (
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted">
                {["Campaign", "Discount", "Applies to", "Dates", "Uses", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => <PromotionRow key={p.id} promo={p} onToggle={toggle} onEdit={setEditing} onDelete={remove} />)}
            </tbody>
          </table>
        )}
      </section>
      <PromotionForm initial={editing} onClose={() => setEditing(null)} onSave={save} />
    </div>
  );
}