import React, { useCallback, useEffect, useState } from "react";
import { Images, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Upload } from "lucide-react";
import { api } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import { Image } from "@/components/ui/image";
import ManualProductEditor from "@/components/admin/ManualProductEditor";
import { cn } from "@/lib/utils";

const EMPTY = { title: "", subtitle: "", badge: "", stock_label: "", image_url: "", image_mobile_url: "", link_url: "", cta_label: "", active_from: "", active_to: "", active: true };

// CMS — Super Admin content management:
//  · HERO: upload desktop + mobile images with title, stock text, badge, link,
//    order, visibility and date scheduling. Slide 1 replaces the big flagship
//    card, slides 2–5 the hero tiles.
//  · MANUAL PRODUCTS: full DRAFT → VALIDATE → PUBLISH workflow (below).
export default function Cms() {
  const { toast } = useToast();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSlides(await api.entities.HeroSlide.list("sort_order", 50));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editing = !!draft.id;

  const makeUpload = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadPublicFile({ file });
      setDraft((d) => ({ ...d, [key]: file_url }));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    if (!draft.image_url) {
      toast({ description: "Upload a desktop hero image first." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        active_from: draft.active_from || undefined,
        active_to: draft.active_to || undefined,
        sort_order: editing ? draft.sort_order : slides.length,
      };
      if (editing) await api.entities.HeroSlide.update(draft.id, payload);
      else await api.entities.HeroSlide.create(payload);
      setDraft(EMPTY);
      toast({ description: "Hero slide saved — live on the storefront." });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => { await api.entities.HeroSlide.update(s.id, { active: !s.active }); load(); };
  const remove = async (s) => { await api.entities.HeroSlide.delete(s.id); load(); };

  const move = async (s, dir) => {
    const idx = slides.findIndex((x) => x.id === s.id);
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    const reordered = [...slides];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    await api.entities.HeroSlide.bulkUpdate(reordered.map((x, i) => ({ id: x.id, sort_order: i })));
    load();
  };

  const field = (key, placeholder, extra = "", type = "text") => (
    <input
      type={type}
      value={draft[key] || ""}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      placeholder={placeholder}
      className={`bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50 ${extra}`}
    />
  );

  const uploadBox = (key, label) => (
    <label className={cn(
      "relative flex flex-col items-center justify-center gap-1 h-32 rounded-lg border-2 border-dashed border-border-hairline bg-surface-primary hover:border-accent-cyan/50 transition cursor-pointer text-center px-2 overflow-hidden",
      key === "image_mobile_url" && draft.image_url ? "h-24" : ""
    )}>
      {draft[key] ? (
        <Image src={draft[key]} className="w-full h-full" />
      ) : (
        <>
          <Upload className="w-4 h-4 text-text-muted" />
          <span className="text-[10px] text-text-muted leading-tight">{label}</span>
        </>
      )}
      <input type="file" accept="image/*" onChange={makeUpload(key)} className="hidden" disabled={uploading} />
    </label>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
          <Images className="w-5 h-5 text-accent-cyan" /> CMS — Homepage & content
        </h1>

        {/* HERO editor */}
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm">Hero slides</h3>
            {editing && (
              <button onClick={() => setDraft(EMPTY)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
            )}
          </div>
          <p className="text-xs text-text-muted">
            Slide 1 replaces the big flagship card on the homepage; slides 2–5 replace the four hero tiles.
            Separate desktop and mobile images supported; scheduling hides the slide outside the date window.
          </p>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-2">
              {uploadBox("image_url", "Desktop image (required)")}
              {uploadBox("image_mobile_url", "Mobile image (optional — portrait)")}
            </div>
            <div className="md:col-span-3 grid grid-cols-2 gap-3 content-start">
              {field("title", "Title (iPhone 18 Pro — Nouveau)", "col-span-2")}
              {field("subtitle", "Subtitle (optional)", "col-span-2")}
              {field("badge", "Badge (NOUVEAU / PROMO)")}
              {field("stock_label", "Stock text (En stock)")}
              {field("link_url", "Link (/category?cat=Smartphones)")}
              {field("cta_label", "Button label (Shop now)")}
              {field("active_from", "Visible from (schedule)", "text-xs", "date")}
              {field("active_to", "Visible until (schedule)", "text-xs", "date")}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={save} disabled={saving || uploading}
              className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> {editing ? "Update slide" : "Add slide"}
            </button>
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-black" />
              Visible on the storefront
            </label>
          </div>
        </div>

        {/* Slides list */}
        {loading ? (
          <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
        ) : (
          <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                  <th className="py-2.5 px-4">#</th><th className="py-2.5 px-4">Images</th><th className="py-2.5 px-4">Content</th>
                  <th className="py-2.5 px-4">Schedule</th><th className="py-2.5 px-4">Live</th><th />
                </tr>
              </thead>
              <tbody>
                {slides.map((s, i) => (
                  <tr key={s.id} className="border-b border-border-hairline last:border-0">
                    <td className="py-2.5 px-4 text-text-muted">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-text-primary">{i + 1}</span>
                        <button onClick={() => move(s, -1)} disabled={i === 0} className="p-1 rounded hover:bg-surface-secondary disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => move(s, 1)} disabled={i === slides.length - 1} className="p-1 rounded hover:bg-surface-secondary disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex gap-1.5">
                        <div className="w-16 h-12 rounded-md overflow-hidden bg-surface-secondary border border-border-hairline">
                          <Image src={s.image_url} className="w-full h-full" />
                        </div>
                        {s.image_mobile_url && (
                          <div className="w-9 h-12 rounded-md overflow-hidden bg-surface-secondary border border-border-hairline">
                            <Image src={s.image_mobile_url} className="w-full h-full" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium">{s.title || <span className="text-text-muted">—</span>}</div>
                      <div className="text-[11px] text-text-muted">
                        {s.badge && <span className="inline-block bg-noon text-noon-fg px-1.5 py-0.5 rounded font-bold me-1">{s.badge}</span>}
                        {s.stock_label}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-text-muted whitespace-nowrap">
                      {s.active_from || s.active_to ? `${s.active_from || "…"} → ${s.active_to || "…"}` : "always"}
                    </td>
                    <td className="py-2.5 px-4">
                      <button onClick={() => toggle(s)}
                        className={cn("text-[10px] px-2 py-0.5 rounded font-medium",
                          s.active ? "bg-emerald-500/10 text-emerald-600" : "bg-surface-secondary text-text-muted")}>
                        {s.active ? "live" : "hidden"}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button onClick={() => setDraft({ ...s })} className="p-1.5 rounded-md hover:bg-surface-secondary text-text-muted hover:text-text-primary" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(s)} className="p-1.5 rounded-md hover:bg-surface-secondary text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {slides.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-text-muted text-xs">
                      No slides yet — the storefront uses the built-in hero. Upload your first image above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual products — DRAFT → VALIDATE → PUBLISH */}
      <ManualProductEditor />
    </div>
  );
}