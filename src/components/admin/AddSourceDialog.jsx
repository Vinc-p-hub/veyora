import React, { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const ADAPTERS = [
  { id: "SITEMAP_JSONLD", label: "Sitemap → product pages (JSON-LD)" },
  { id: "URL_LIST_JSONLD", label: "URL list → product pages (JSON-LD)" },
  { id: "FEED_JSON", label: "JSON product feed" },
];

const EMPTY = {
  name: "",
  base_url: "",
  adapter: "SITEMAP_JSONLD",
  feed_url: "",
  items_path: "products",
  field_map: "",
  url_pattern: "",
  seed_urls: "",
  priority: "5",
  crawl_interval_minutes: "720",
  requests_per_minute: "10",
  max_products_per_run: "30",
  default_currency: "USD",
  supplier_score: "85",
  available_countries: "",
};

const inputCls =
  "bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50";

// Super Admin: add a new authorized crawl source in a few fields. The source
// then feeds the standard DISCOVER → … → PUBLISH pipeline like any other.
export default function AddSourceDialog({ onDone, onCancel }) {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Bulk add: auto-detect robots.txt + sitemap per merchant site (10 per
  // batch). Allowed sites become SITEMAP sources immediately; sites that
  // disallow automated crawling are marked unavailable (DISABLED), never
  // crawled; sites without a sitemap are reported for manual setup.
  const bulkAdd = async () => {
    const urls = bulk.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (!urls.length) {
      setErr("Add at least one merchant base URL.");
      return;
    }
    setBulkBusy(true);
    setErr(null);
    try {
      const res = await base44.functions.invoke("sourceAutodetect", { base_urls: urls });
      const results = res.data?.results || [];
      let added = 0;
      let blocked = 0;
      const manual = [];
      for (const r of results) {
        let name = "";
        try {
          name = new URL(r.base_url).hostname.replace(/^www\./, "");
        } catch (_e) {
          manual.push(`${r.base_url || "invalid URL"}: ${r.note}`);
          continue;
        }
        if (r.status === "ok") {
          await base44.entities.CrawlerSource.create({
            name,
            base_url: r.base_url,
            adapter: "SITEMAP_JSONLD",
            feed_url: r.feed_url,
            priority: 5,
            crawl_interval_minutes: 720,
            requests_per_minute: 10,
            max_products_per_run: 30,
            default_currency: "USD",
            supplier_score: 80,
            enabled: true,
            status: "ACTIVE",
          });
          added++;
        } else if (r.status === "not_allowed") {
          await base44.entities.CrawlerSource.create({
            name,
            base_url: r.base_url,
            adapter: "SITEMAP_JSONLD",
            feed_url: r.robots_url,
            enabled: false,
            status: "DISABLED",
            last_error: r.note,
          });
          blocked++;
        } else {
          manual.push(`${name}: ${r.note}`);
        }
      }
      onDone(
        `Bulk add: ${added} source(s) added · ${blocked} marked unavailable (robots.txt) · ${manual.length} need manual setup` +
          (manual.length ? ` — ${manual.join(" · ")}` : "")
      );
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Detection failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const save = async () => {
    setErr(null);
    if (!f.name.trim() || !f.base_url.trim()) {
      setErr("Name and base URL are required.");
      return;
    }
    if (f.adapter !== "URL_LIST_JSONLD" && !f.feed_url.trim()) {
      setErr("Feed / sitemap URL is required for this adapter.");
      return;
    }
    if (f.adapter === "URL_LIST_JSONLD" && !f.seed_urls.split("\n").map((s) => s.trim()).filter(Boolean).length) {
      setErr("Add at least one seed product URL.");
      return;
    }
    let fieldMap;
    if (f.adapter === "FEED_JSON" && f.field_map.trim()) {
      try {
        fieldMap = JSON.parse(f.field_map);
      } catch (_e) {
        setErr("Field map is not valid JSON.");
        return;
      }
    }
    setSaving(true);
    try {
      await base44.entities.CrawlerSource.create({
        name: f.name.trim(),
        base_url: f.base_url.trim().replace(/\/+$/, ""),
        adapter: f.adapter,
        feed_url: f.feed_url.trim() || undefined,
        items_path: f.adapter === "FEED_JSON" ? f.items_path.trim() || undefined : undefined,
        field_map: fieldMap,
        url_pattern: f.url_pattern.trim() || undefined,
        seed_urls: f.seed_urls.split("\n").map((s) => s.trim()).filter(Boolean),
        priority: Math.max(1, Math.min(10, parseInt(f.priority) || 5)),
        crawl_interval_minutes: parseInt(f.crawl_interval_minutes) || 720,
        requests_per_minute: Math.max(1, parseInt(f.requests_per_minute) || 10),
        max_products_per_run: Math.max(1, parseInt(f.max_products_per_run) || 30),
        default_currency: (f.default_currency || "USD").toUpperCase().slice(0, 3),
        supplier_score: Math.max(0, Math.min(100, parseInt(f.supplier_score) || 85)),
        available_countries: f.available_countries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
        enabled: true,
        status: "ACTIVE",
      });
      onDone(`Source "${f.name.trim()}" added — run it to start discovery.`);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Could not save the source.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Add a crawl source</h3>
        <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-surface-secondary text-text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Only add sources you are authorized to crawl — the worker respects each site's robots.txt and never bypasses
        CAPTCHA, login, paywall or anti-bot protections.
      </p>

      <div className="grid md:grid-cols-3 gap-3">
        <input value={f.name} onChange={set("name")} placeholder="Name (Apple Store US)" className={cn(inputCls, "md:col-span-2")} />
        <input value={f.base_url} onChange={set("base_url")} placeholder="Base URL (https://…)" className={inputCls} />
        <select value={f.adapter} onChange={set("adapter")} className={inputCls}>
          {ADAPTERS.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <input
          value={f.feed_url}
          onChange={set("feed_url")}
          placeholder={f.adapter === "SITEMAP_JSONLD" ? "Sitemap URL (https://…/sitemap.xml)" : "Feed URL"}
          className={cn(inputCls, "md:col-span-2", f.adapter === "URL_LIST_JSONLD" && "hidden")}
        />
        <input
          value={f.url_pattern}
          onChange={set("url_pattern")}
          placeholder="URL filter regex (iphone|macbook)"
          className={inputCls}
        />
        <input value={f.default_currency} onChange={set("default_currency")} placeholder="Currency (USD)" className={cn(inputCls, "uppercase")} />
        <input value={f.supplier_score} onChange={set("supplier_score")} placeholder="Seller reliability 0-100" className={inputCls} />
        <input value={f.priority} onChange={set("priority")} placeholder="Priority 1-10" className={inputCls} />
        <input value={f.max_products_per_run} onChange={set("max_products_per_run")} placeholder="Max products / run" className={inputCls} />
        <input value={f.crawl_interval_minutes} onChange={set("crawl_interval_minutes")} placeholder="Interval (minutes)" className={inputCls} />
        <input value={f.requests_per_minute} onChange={set("requests_per_minute")} placeholder="Rate limit (req/min)" className={inputCls} />
        <input value={f.available_countries} onChange={set("available_countries")} placeholder="Ships to (AE, SA, US)" className={cn(inputCls, "md:col-span-2")} />
      </div>

      {f.adapter === "URL_LIST_JSONLD" && (
        <textarea
          value={f.seed_urls}
          onChange={set("seed_urls")}
          placeholder={"One product URL per line\nhttps://…/product/iphone-18-pro"}
          rows={4}
          className={cn(inputCls, "w-full font-mono text-xs")}
        />
      )}
      {f.adapter === "FEED_JSON" && (
        <div className="grid md:grid-cols-2 gap-3">
          <input value={f.items_path} onChange={set("items_path")} placeholder="Items path (products.items)" className={inputCls} />
          <input
            value={f.field_map}
            onChange={set("field_map")}
            placeholder='Field map JSON {"title":"name","price":"price"}'
            className={cn(inputCls, "font-mono text-xs")}
          />
        </div>
      )}

      {/* Bulk add — auto-detect configuration for many merchant sites at once.
          robots.txt is respected: sites that disallow automated crawling are
          marked unavailable (DISABLED), never crawled. */}
      <div className="border-t border-border-hairline pt-4 space-y-2">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-cyan" /> Bulk add — auto-detect
        </h3>
        <p className="text-[11px] text-text-muted">
          Paste up to 10 merchant base URLs (one per line). Each is checked against robots.txt and its sitemap is
          detected automatically; allowed sites become sitemap sources ready to crawl, disallowed sites are marked
          unavailable, and sites without a sitemap are reported for manual setup.
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={4}
          placeholder={"https://www.samsung.com\nhttps://www.mi.com\nhttps://www.notebookbilliger.de"}
          className={cn(inputCls, "w-full font-mono text-xs")}
        />
        <button
          onClick={bulkAdd}
          disabled={bulkBusy || saving}
          className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-semibold hover:border-accent-cyan/40 disabled:opacity-40 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> {bulkBusy ? "Detecting…" : "Detect & add sources"}
        </button>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border-hairline text-sm text-text-muted hover:text-text-primary">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save source"}
        </button>
      </div>
    </div>
  );
}