import React, { useCallback, useEffect, useState } from "react";
import { Package, Plus, Trash2, Pencil, Upload, Check, Rocket, Loader2, Video } from "lucide-react";
import { api } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import { Image } from "@/components/ui/image";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Smartphones", "Laptops", "Tablets", "Headphones & Earbuds", "TVs & Monitors",
  "Cameras", "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home",
  "Networking", "Computer Components", "Phones", "Computers", "TV", "Wearables",
];
const STOCK_STATUSES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "PREORDER", "UNKNOWN"];

const STATUS_CHIP = {
  DRAFT: "bg-surface-secondary text-text-muted",
  VALIDATED: "bg-amber-500/10 text-amber-600",
  PUBLISHED: "bg-emerald-500/10 text-emerald-600",
};

const EMPTY = {
  name: "", brand: "", category: "Smartphones", description: "",
  customer_price: "", currency: "USD", sku: "", stock_status: "IN_STOCK",
  color: "", ram: "", storage: "", specs: "", badge: "",
  featured: false, new_arrival: true,
};

const slugify = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Manual product creation by the Super Admin: DRAFT → VALIDATE → PUBLISH.
// A published manual product is a real catalog product (homepage, category,
// search) with the internal VEYRO allocation applied at publish time.
// A CMS image alone never becomes a product — only this explicit workflow does.
export default function ManualProductEditor() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alloc, setAlloc] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api.entities.Product.list("-created_date", 200);
      setRows(all.filter((p) => !p.source_id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.entities.SiteSetting.filter({ key: "stock_allocation_default" }, null, 1)
      .then((r) => setAlloc(parseInt(r[0]?.value) || 10))
      .catch(() => {});
  }, [load]);

  const editing = !!draft.id;

  const uploadImages = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files.slice(0, 8)) {
        const { file_url } = await api.integrations.Core.UploadPublicFile({ file });
        urls.push(file_url);
      }
      setImages((prev) => [...prev, ...urls]);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const uploadVideos = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploadingVideo(true);
    try {
      const urls = [];
      for (const file of files.slice(0, 3 - videos.length)) {
        const { file_url } = await api.integrations.Core.UploadPublicFile({ file });
        urls.push(file_url);
      }
      setVideos((prev) => [...prev, ...urls].slice(0, 3));
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  const parseSpecs = (text) => {
    const specs = {};
    for (const line of (text || "").split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) specs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return Object.keys(specs).length ? specs : undefined;
  };

  const buildBase = () => ({
    name: draft.name.trim(),
    slug: editing ? draft.slug : `${slugify(draft.name)}-${Date.now().toString(36).slice(-4)}`,
    brand: draft.brand.trim(),
    category: draft.category,
    description: draft.description.trim() || undefined,
    customer_price: parseFloat(draft.customer_price),
    currency: (draft.currency || "USD").toUpperCase().slice(0, 3),
    sku: draft.sku.trim() || undefined,
    stock_status: draft.stock_status,
    badge: draft.badge.trim() || undefined,
    specifications: parseSpecs(draft.specs),
    variant_info: (draft.color || draft.ram || draft.storage)
      ? { color: draft.color || undefined, ram: draft.ram || undefined, storage: draft.storage || undefined }
      : undefined,
    image_url: images[0],
    gallery: images.length > 1 ? images.slice(1) : undefined,
    videos: videos.length ? videos : undefined,
    source_name: "VEYRO Direct",
  });

  const save = async () => {
    if (!draft.name.trim() || !draft.brand.trim() || !draft.customer_price) {
      toast({ description: "Name, brand and price are required." });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.entities.Product.update(draft.id, buildBase());
        toast({ description: "Draft updated." });
      } else {
        await api.entities.Product.create({ ...buildBase(), status: "DRAFT" });
        toast({ description: "Draft created — validate then publish." });
      }
      setDraft(EMPTY);
      setImages([]);
      setVideos([]);
      await load();
    } finally {
      setSaving(false);
    }
  };

  // SAVE & PUBLISH: creates the manual product AND publishes it to the front
  // store (homepage, category, search) in one click — the DRAFT → VALIDATE →
  // PUBLISH path stays available for staged work.
  const saveAndPublish = async () => {
    if (!draft.name.trim() || !draft.brand.trim() || !draft.customer_price) {
      toast({ description: "Name, brand and price are required." });
      return;
    }
    if (!images.length) {
      toast({ description: "Upload at least one image before publishing." });
      return;
    }
    setSaving(true);
    try {
      let id;
      if (editing) {
        await api.entities.Product.update(draft.id, { ...buildBase(), status: "VALIDATED" });
        id = draft.id;
      } else {
        const created = await api.entities.Product.create({ ...buildBase(), status: "VALIDATED" });
        id = created.id;
      }
      const record = await api.entities.Product.get(id);
      setDraft(EMPTY);
      setImages([]);
      setVideos([]);
      await publish(record);
    } finally {
      setSaving(false);
    }
  };

  // VALIDATE gate: a manual product can only move to publish if it is complete.
  const validate = async (p) => {
    if (!p.image_url) { toast({ description: "Upload at least one image before validating." }); return; }
    if (!p.customer_price) { toast({ description: "Set a price before validating." }); return; }
    await api.entities.Product.update(p.id, { status: "VALIDATED", review_reason: null });
    toast({ description: "Product validated — ready to publish." });
    load();
  };

  // PUBLISH: the manual product becomes a real catalog product, gets the
  // internal VEYRO allocation (+10 default) and lands in New Arrivals if flagged.
  const publish = async (p) => {
    await api.entities.Product.update(p.id, {
      status: "PUBLISHED",
      premium_status: "APPROVED",
      premium_score: p.specifications || p.badge ? 97 : 92,
      veyro_allocated_stock: alloc,
      available_to_sell: alloc,
      stock_changed_at: new Date().toISOString(),
      first_seen_at: p.first_seen_at || new Date().toISOString(),
      available_countries: ["US", "AE", "FR"],
      delivery_days: 5,
    });
    toast({ description: "Product published — visible in catalog, category and search." });
    load();
  };

  const removeImage = (i) => setImages((prev) => prev.filter((_, x) => x !== i));
  const remove = async (p) => { await api.entities.Product.delete(p.id); load(); };
  const startEdit = (p) => {
    setDraft({
      id: p.id, slug: p.slug, name: p.name, brand: p.brand, category: p.category,
      description: p.description || "", customer_price: String(p.customer_price ?? ""),
      currency: p.currency || "USD", sku: p.sku || "", stock_status: p.stock_status || "IN_STOCK",
      color: p.variant_info?.color || "", ram: p.variant_info?.ram || "", storage: p.variant_info?.storage || "",
      specs: Object.entries(p.specifications || {}).map(([k, v]) => `${k}: ${v}`).join("\n"),
      badge: p.badge || "", featured: p.premium_score >= 99, new_arrival: true,
    });
    setImages([p.image_url, ...(p.gallery || [])].filter(Boolean));
    setVideos(Array.isArray(p.videos) ? p.videos.filter(Boolean) : []);
  };

  const input = "bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50";

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-lg flex items-center gap-2">
        <Package className="w-5 h-5 text-accent-cyan" /> Manual products — DRAFT → VALIDATE → PUBLISH
      </h2>

      {/* Editor */}
      <div className="bg-surface-card border border-border-hairline rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm">{editing ? `Edit: ${draft.name}` : "New manual product"}</h3>
          {editing && (
            <button onClick={() => { setDraft(EMPTY); setImages([]); setVideos([]); }} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
          )}
        </div>

        {/* Images */}
        <div className="flex items-center gap-2 flex-wrap">
          {images.map((url, i) => (
            <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border-hairline group">
              <Image src={url} className="w-full h-full" />
              <button onClick={() => removeImage(i)}
                className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] py-0.5 opacity-0 group-hover:opacity-100 transition">remove</button>
              {i === 0 && <span className="absolute top-1 start-1 text-[8px] font-bold bg-noon text-noon-fg px-1 rounded">MAIN</span>}
            </div>
          ))}
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border-hairline bg-surface-primary hover:border-accent-cyan/50 transition flex flex-col items-center justify-center cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-text-muted" /> : <Upload className="w-4 h-4 text-text-muted" />}
            <input type="file" accept="image/*" multiple onChange={uploadImages} className="hidden" disabled={uploading} />
          </label>
          <span className="text-[10px] text-text-muted">First image = main. Gallery up to 8.</span>
        </div>

        {/* Videos */}
        <div className="flex items-center gap-2 flex-wrap">
          {videos.map((url, i) => (
            <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border-hairline bg-surface-secondary group">
              <video src={url} preload="metadata" muted className="w-full h-full object-cover" />
              <button onClick={() => setVideos((prev) => prev.filter((_, x) => x !== i))}
                className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] py-0.5 opacity-0 group-hover:opacity-100 transition">remove</button>
              <span className="absolute top-1 start-1 text-[8px] font-bold bg-noon text-noon-fg px-1 rounded flex items-center gap-0.5"><Video className="w-2 h-2" />{i + 1}</span>
            </div>
          ))}
          {videos.length < 3 && (
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border-hairline bg-surface-primary hover:border-accent-cyan/50 transition flex flex-col items-center justify-center cursor-pointer">
              {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin text-text-muted" /> : <Video className="w-4 h-4 text-text-muted" />}
              <input type="file" accept="video/*" multiple onChange={uploadVideos} className="hidden" disabled={uploadingVideo} />
            </label>
          )}
          <span className="text-[10px] text-text-muted">Product videos — up to 3, shown on the product page.</span>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Product name *" className={cn(input, "md:col-span-2")} />
          <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="Brand *" className={input} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={input}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={draft.customer_price} onChange={(e) => setDraft({ ...draft, customer_price: e.target.value })} placeholder="Customer price *" type="number" min="0" step="0.01" className={input} />
          <input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} placeholder="Currency (USD)" className={cn(input, "uppercase")} />
          <input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="SKU" className={input} />
          <select value={draft.stock_status} onChange={(e) => setDraft({ ...draft, stock_status: e.target.value })} className={input}>
            {STOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="Color variant" className={input} />
          <input value={draft.ram} onChange={(e) => setDraft({ ...draft, ram: e.target.value })} placeholder="RAM (16 GB)" className={input} />
          <input value={draft.storage} onChange={(e) => setDraft({ ...draft, storage: e.target.value })} placeholder="Storage (256 GB)" className={input} />
          <input value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="Badge (NEW / PROMO)" className={input} />
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" rows={3} className={cn(input, "md:col-span-4")} />
          <textarea value={draft.specs} onChange={(e) => setDraft({ ...draft, specs: e.target.value })} placeholder={"Specifications — one per line\nProcessor: Apple M4\nDisplay: 6.9\" OLED"} rows={3} className={cn(input, "md:col-span-4 font-mono text-xs")} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || uploading || uploadingVideo}
              className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-semibold hover:border-accent-cyan/40 disabled:opacity-40 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> {editing ? "Update draft" : "Save draft"}
            </button>
            <button onClick={saveAndPublish} disabled={saving || uploading || uploadingVideo}
              className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
              <Rocket className="w-4 h-4" /> Save & publish to store
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} className="accent-black" /> Featured
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={draft.new_arrival} onChange={(e) => setDraft({ ...draft, new_arrival: e.target.checked })} className="accent-black" /> New arrival on publish
          </label>
          <span className="text-[11px] text-text-muted">Publish grants +{alloc} internal VEYRO stock allocation automatically.</span>
        </div>
      </div>

      {/* Manual products list */}
      {loading ? (
        <div className="h-32 bg-surface-card rounded-lg animate-pulse" />
      ) : (
        <div className="bg-surface-card border border-border-hairline rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-text-muted border-b border-border-hairline">
                <th className="py-2.5 px-4">Product</th><th className="py-2.5 px-4">Price</th>
                <th className="py-2.5 px-4">Status</th><th className="py-2.5 px-4">Workflow</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border-hairline last:border-0">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-surface-secondary border border-border-hairline shrink-0">
                        {p.image_url && <Image src={p.image_url} className="w-full h-full" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[220px]">{p.name}</div>
                        <div className="text-[10px] text-text-muted">{p.brand} · {p.category}{p.badge ? ` · ${p.badge}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-mono">{p.customer_price?.toLocaleString()} {p.currency}</td>
                  <td className="py-2.5 px-4">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", STATUS_CHIP[p.status] || "bg-surface-secondary text-text-muted")}>{p.status}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="inline-flex gap-1.5">
                      {p.status === "DRAFT" && (
                        <button onClick={() => validate(p)} className="px-2.5 py-1.5 rounded-md border border-border-hairline text-xs flex items-center gap-1 hover:border-amber-400/50"><Check className="w-3 h-3" /> Validate</button>
                      )}
                      {p.status === "VALIDATED" && (
                        <button onClick={() => publish(p)} className="px-2.5 py-1.5 rounded-md bg-noon text-noon-fg text-xs font-semibold flex items-center gap-1"><Rocket className="w-3 h-3" /> Publish</button>
                      )}
                      {p.status === "PUBLISHED" && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Live · +{p.veyro_allocated_stock} stock</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-md hover:bg-surface-secondary text-text-muted hover:text-text-primary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(p)} className="p-1.5 rounded-md hover:bg-surface-secondary text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-6 px-4 text-center text-text-muted text-xs">No manual products yet — create one above. CMS images alone never become products.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}