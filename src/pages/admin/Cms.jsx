import React, { useCallback, useEffect, useState } from "react";
import { Images, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

const EMPTY = { title: "", subtitle: "", badge: "", stock_label: "", image_url: "", link_url: "", cta_label: "", active: true };

// CMS: hero content management. Upload images with title, stock text and other
// fields — the first active slide replaces the big flagship hero card, the
// next ones replace the hero tiles on the storefront homepage.
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
      setSlides(await base44.entities.HeroSlide.list("sort_order", 50));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const editing = !!draft.id;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setDraft((d) => ({ ...d, image_url: file_url }));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    if (!draft.image_url) {
      toast({ description: "Upload a hero image first." });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...draft, sort_order: editing ? draft.sort_order : slides.length };
      if (editing) await base44.entities.HeroSlide.update(draft.id, payload);
      else await base44.entities.HeroSlide.create(payload);
      setDraft(EMPTY);
      toast({ description: "Hero slide saved — live on the storefront." });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => { await base44.entities.HeroSlide.update(s.id, { active: !s.active }); load(); };
  const remove = async (s) => { await base44.entities.HeroSlide.delete(s.id); load(); };

  const move = async (s, dir) => {
    const idx = slides.findIndex((x) => x.id === s.id);
    const j = idx + dir;
    if (j < 0 || j >= slides.length) return;
    const reordered = [...slides];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    await base44.entities.HeroSlide.bulkUpdate(reordered.map((x, i) => ({ id: x.id, sort_order: i })));
    load();
  };

  const field = (key, placeholder, extra = "") => (
    <input
      value={draft[key] || ""}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      placeholder={placeholder}
      className={`bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50 ${extra}`}
    />
  );

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
        <Images className="w-5 h-5 text-accent-cyan" /> CMS — Hero content
      </h1>
      <p className="text-xs text-text-muted -mt-2">
        Upload your own hero images with title, stock text and link. Slide 1 replaces the big flagship card on the
        homepage; slides 2–5 replace the four hero tiles. Empty CMS falls back to the built-in hero.
      </p>

      {/* Editor form */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm">{editing ? `Edit slide ${draft.sort_order + 1}` : "New hero slide"}</h3>
          {editing && (
            <button onClick={() => setDraft(EMPTY)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-1 space-y-2">
            {/* Image upload + preview */}
            <label className="flex flex-col items-center justify-center gap-1.5 h-36 rounded-lg border-2 border-dashed border-border-hairline bg-surface-primary hover:border-accent-cyan/50 transition cursor-pointer text-center px-2">
              {uploading ? (
                <span className="text-xs text-text-muted animate-pulse">Uploading…</span>
              ) : draft.image_url ? (
                <Image src={draft.image_url} className="w-full h-full rounded-md" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-text-muted" />
                  <span className="text-xs text-text-muted">Click to upload an image</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={upload} className="hidden" disabled={uploading} />
            </label>
            {draft.image_url && <p className="text-[10px] text-text-muted truncate">{draft.image_url}</p>}
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-3 content-start">
            {field("title", "Title (iPhone 18 Pro — Nouveau)", "col-span-2")}
            {field("subtitle", "Subtitle (optional)", "col-span-2")}
            {field("badge", "Badge (NOUVEAU / PROMO)")}
            {field("stock_label", "Stock text (En stock)")}
            {field("link_url", "Link (/category?cat=Smartphones)")}
            {field("cta_label", "Button label (Shop now)")}
          </div>
        </div>

        <div className="flex items-center gap-3">
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
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">#</th><th className="py-2.5 px-4">Image</th><th className="py-2.5 px-4">Content</th>
                <th className="py-2.5 px-4">Link</th><th className="py-2.5 px-4">Live</th><th />
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
                    <div className="w-16 h-12 rounded-md overflow-hidden bg-surface-secondary border border-border-hairline">
                      <Image src={s.image_url} className="w-full h-full" />
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium">{s.title || <span className="text-text-muted">—</span>}</div>
                    <div className="text-[11px] text-text-muted">
                      {s.badge && <span className="inline-block bg-noon text-noon-fg px-1.5 py-0.5 rounded font-bold mr-1">{s.badge}</span>}
                      {s.stock_label}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-text-muted max-w-[160px] truncate">{s.link_url || "—"}</td>
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
  );
}