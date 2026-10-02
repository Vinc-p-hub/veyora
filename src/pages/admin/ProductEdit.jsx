import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import ProductReviews from "@/components/admin/reviews/ProductReviews";

const CATEGORIES = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors", "Cameras",
  "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home", "Networking",
  "Computer Components", "Phones", "Computers", "TV", "Wearables",
];
const STATUSES = ["PUBLISHED", "REVIEW", "DISABLED", "REJECTED"];
const inputCls = "w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50";

// Manual product management — the real supplier stock (stock_status, crawled)
// stays read-only; only VEYRO-side stock, images and content are editable.
// Every veyro_stock change is logged as an immutable StockMovement.
export default function ProductEdit() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [movements, setMovements] = useState([]);
  const [origVeyroStock, setOrigVeyroStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [stockReason, setStockReason] = useState("Manual stock adjustment");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prod, moves] = await Promise.all([
        base44.entities.Product.get(id),
        base44.entities.StockMovement.filter({ product_id: id }, "-created_date", 20).catch(() => []),
      ]);
      setP(prod);
      setMovements(moves);
      setOrigVeyroStock(Number(prod.veyro_stock) || 0);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-32 bg-surface-card rounded-lg animate-pulse" />;
  if (!p) return <p className="text-sm text-text-muted">Product not found.</p>;

  const patch = (data) => setP((x) => ({ ...x, ...data }));
  const gallery = Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [];

  const saveFields = async () => {
    setSaving(true); setMsg("");
    try {
      await base44.entities.Product.update(p.id, {
        name: p.name, brand: p.brand, model: p.model || "", sku: p.sku || "",
        category: p.category, description: p.description || "",
        customer_price: Number(p.customer_price) || 0,
        seo_title: p.seo_title || "", meta_description: p.meta_description || "",
        status: p.status,
      });
      setMsg("Product details saved.");
    } catch (e) {
      setMsg(e.message || "Save failed");
    } finally { setSaving(false); }
  };

  const saveStock = async () => {
    setSaving(true); setMsg("");
    try {
      const newVeyro = Math.max(0, Math.floor(Number(p.veyro_stock) || 0));
      await base44.entities.Product.update(p.id, {
        veyro_stock: newVeyro,
        reserved_stock: Math.max(0, Math.floor(Number(p.reserved_stock) || 0)),
        available_to_sell: Math.max(0, Math.floor(Number(p.available_to_sell) || 0)),
      });
      if (newVeyro !== origVeyroStock) {
        await base44.entities.StockMovement.create({
          product_id: p.id,
          product_name: p.name,
          qty: newVeyro - origVeyroStock,
          old_stock: origVeyroStock,
          new_stock: newVeyro,
          reason: stockReason || "Manual stock adjustment",
          order_number: "",
          actor_email: "",
        });
        setOrigVeyroStock(newVeyro);
      }
      setMsg("Stock saved.");
      await load();
    } catch (e) {
      setMsg(e.message || "Save failed");
      setSaving(false);
    }
  };

  const saveImages = async (nextGallery, mainUrl) => {
    const g = [...new Set(nextGallery.filter(Boolean))];
    const data = { gallery: g, image_status: g.length ? "COMPLETE" : p.image_status };
    if (mainUrl) data.image_url = mainUrl;
    await base44.entities.Product.update(p.id, data);
    setP((x) => ({ ...x, ...data }));
  };

  const moveImg = async (i, dir) => {
    const g = [...gallery];
    const j = i + dir;
    if (j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]];
    await saveImages(g);
  };

  const removeImg = async (i) => saveImages(gallery.filter((_, x) => x !== i));

  const setMain = async (i) => {
    const newMain = gallery[i];
    const rest = gallery.filter((_, x) => x !== i);
    await saveImages([...new Set([p.image_url, ...rest])].filter((u) => u !== newMain), newMain);
  };

  const addImage = async () => {
    const url = newImageUrl.trim();
    setNewImageUrl("");
    if (!url || url === p.image_url || gallery.includes(url)) return;
    await saveImages([...gallery, url]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" /> Products
        </Link>
        <h1 className="font-display font-bold text-xl md:text-2xl truncate">{p.name}</h1>
        <span className={cn("text-[10px] px-2 py-0.5 rounded shrink-0",
          p.status === "PUBLISHED" ? "text-emerald-600 bg-emerald-500/10" : "text-amber-600 bg-amber-500/10")}>
          {p.status}
        </span>
        <Link to={`/product/${p.slug}`} target="_blank" className="text-xs text-accent-cyan hover:underline ms-auto">View on storefront ↗</Link>
      </div>
      {msg && <div className="rounded-lg bg-surface-card border border-border-hairline p-3 text-xs">{msg}</div>}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Details */}
        <section className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-3">
          <h2 className="font-display font-semibold">Details</h2>
          <label className="block text-xs font-medium">Title<input className={cn(inputCls, "mt-1")} value={p.name || ""} onChange={(e) => patch({ name: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">Brand<input className={cn(inputCls, "mt-1")} value={p.brand || ""} onChange={(e) => patch({ brand: e.target.value })} /></label>
            <label className="block text-xs font-medium">Model<input className={cn(inputCls, "mt-1")} value={p.model || ""} onChange={(e) => patch({ model: e.target.value })} /></label>
            <label className="block text-xs font-medium">SKU<input className={cn(inputCls, "mt-1")} value={p.sku || ""} onChange={(e) => patch({ sku: e.target.value })} /></label>
            <label className="block text-xs font-medium">Category
              <select className={cn(inputCls, "mt-1")} value={p.category} onChange={(e) => patch({ category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium">Description
            <textarea rows={4} className={cn(inputCls, "mt-1")} value={p.description || ""} onChange={(e) => patch({ description: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium">Price (USD)
              <input type="number" step="0.01" className={cn(inputCls, "mt-1")} value={p.customer_price ?? ""} onChange={(e) => patch({ customer_price: e.target.value })} />
            </label>
            <label className="block text-xs font-medium">Visibility
              <select className={cn(inputCls, "mt-1")} value={p.status} onChange={(e) => patch({ status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <h3 className="font-display font-semibold text-sm pt-1">SEO</h3>
          <label className="block text-xs font-medium">SEO title
            <input className={cn(inputCls, "mt-1")} placeholder={`${p.brand || ""} ${p.name || ""}`.trim()} value={p.seo_title || ""} onChange={(e) => patch({ seo_title: e.target.value })} />
          </label>
          <label className="block text-xs font-medium">Meta description
            <textarea rows={2} className={cn(inputCls, "mt-1")} value={p.meta_description || ""} onChange={(e) => patch({ meta_description: e.target.value })} />
          </label>
          <button onClick={saveFields} disabled={saving} className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40">Save details</button>
        </section>

        {/* Stock */}
        <section className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-3">
          <h2 className="font-display font-semibold">Stock</h2>
          <p className="text-[11px] text-text-muted leading-snug">
            Supplier stock is the real crawled status and is never edited here. VEYRO stock is VEYRO's own physical
            inventory — it takes priority for fulfillment when free units cover the order.
          </p>
          <div className="rounded-lg bg-surface-primary p-3 text-xs">
            Supplier stock: <span className="text-text-primary font-semibold">{(p.stock_status || "UNKNOWN").replace(/_/g, " ").toLowerCase()}</span>
            <span className="text-text-muted"> · via {p.source_name}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium">VEYRO stock
              <input type="number" min="0" className={cn(inputCls, "mt-1")} value={p.veyro_stock ?? 0} onChange={(e) => patch({ veyro_stock: e.target.value })} />
            </label>
            <label className="block text-xs font-medium">Reserved
              <input type="number" min="0" className={cn(inputCls, "mt-1")} value={p.reserved_stock ?? 0} onChange={(e) => patch({ reserved_stock: e.target.value })} />
            </label>
            <label className="block text-xs font-medium">Sellable allocation
              <input type="number" min="0" className={cn(inputCls, "mt-1")} value={p.available_to_sell ?? 0} onChange={(e) => patch({ available_to_sell: e.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-medium">Reason (logged in the stock history)
            <input className={cn(inputCls, "mt-1")} value={stockReason} onChange={(e) => setStockReason(e.target.value)} />
          </label>
          <button onClick={saveStock} disabled={saving} className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40">Save stock</button>
          <h3 className="font-display font-semibold text-sm pt-1">Stock movements ({movements.length})</h3>
          <div className="max-h-48 overflow-y-auto text-xs">
            {movements.length === 0 ? <p className="text-text-muted">No movements recorded yet.</p> : movements.map((m) => (
              <div key={m.id} className="flex justify-between gap-2 border-b border-border-hairline last:border-0 py-1.5">
                <span className={cn("text-mono shrink-0", m.qty > 0 ? "text-emerald-600" : "text-red-600")}>
                  {m.qty > 0 ? `+${m.qty}` : m.qty} ({m.old_stock}→{m.new_stock})
                </span>
                <span className="text-text-muted truncate">{m.reason}{m.order_number ? ` · ${m.order_number}` : ""}</span>
                <span className="text-text-muted shrink-0">{m.created_date ? new Date(m.created_date).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Images */}
      <section className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-3">
        <h2 className="font-display font-semibold">Images — real gallery only</h2>
        <p className="text-[11px] text-text-muted leading-snug">
          The gallery holds only real images. Never duplicate an image to fill it — remove, reorder, set the main
          image, or add real image URLs.
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="relative w-28 h-28 rounded-lg overflow-hidden border-2 border-accent-cyan shrink-0">
            <img src={p.image_url} alt={`${p.name} — main`} className="w-full h-full object-cover" />
            <span className="absolute bottom-0 inset-x-0 bg-accent-cyan/90 text-[9px] text-center py-0.5 text-white">MAIN</span>
          </div>
          {gallery.map((img, i) => (
            <div key={img} className="relative w-28 h-28 rounded-lg overflow-hidden border border-border-hairline shrink-0 group">
              <img src={img} alt={`${p.name} — view ${i + 2}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                <button title="Set as main" onClick={() => setMain(i)} className="p-1.5 bg-white/90 rounded-md hover:bg-white"><Star className="w-3.5 h-3.5 text-badge-premium" /></button>
                <button title="Move left" onClick={() => moveImg(i, -1)} className="p-1.5 bg-white/90 rounded-md hover:bg-white"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button title="Move right" onClick={() => moveImg(i, 1)} className="p-1.5 bg-white/90 rounded-md hover:bg-white"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button title="Remove" onClick={() => removeImg(i)} className="p-1.5 bg-white/90 rounded-md hover:bg-white"><Trash2 className="w-3.5 h-3.5 text-red-600" /></button>
              </div>
            </div>
          ))}
          {gallery.length === 0 && <p className="text-xs text-text-muted self-center">No gallery images — only the main image exists.</p>}
        </div>
        <div className="flex gap-2 max-w-lg">
          <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Real image URL (https://…)" className={inputCls} />
          <button onClick={addImage} className="px-4 py-2 rounded-lg border border-border-hairline text-sm hover:border-accent-cyan/40 flex items-center gap-1.5 shrink-0">
            <ImagePlus className="w-4 h-4" /> Add
          </button>
        </div>
      </section>

      {/* Reviews — manual entry + file import, effective on the storefront */}
      <ProductReviews product={p} />
    </div>
  );
}