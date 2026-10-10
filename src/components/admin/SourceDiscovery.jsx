import React, { useState } from "react";
import { Radar, Plus, ShieldX } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

// SOURCE DISCOVERY & REVIEW — paste candidate merchant URLs (e.g. from brand
// "Where to Buy" pages), run robots.txt + sitemap detection, then review each
// candidate BEFORE activation. Blocked sites are recorded and never crawled.
const REVIEW_STATUS = {
  ok: { label: "CRAWL_ALLOWED", cls: "bg-emerald-500/10 text-emerald-600" },
  not_allowed: { label: "BLOCKED", cls: "bg-red-500/10 text-red-600" },
  no_sitemap: { label: "PARTNER_REQUIRED", cls: "bg-amber-500/10 text-amber-600" },
  invalid: { label: "INVALID", cls: "bg-surface-secondary text-text-muted" },
};

export default function SourceDiscovery({ onAdded }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [done, setDone] = useState(new Set());
  const [err, setErr] = useState(null);

  const detect = async () => {
    const urls = text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (!urls.length) { setErr("Add at least one candidate URL."); return; }
    setBusy(true);
    setErr(null);
    setDone(new Set());
    try {
      const res = await api.functions.invoke("sourceAutodetect", { base_urls: urls });
      setResults(res.data?.results || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Detection failed.");
    } finally {
      setBusy(false);
    }
  };

  const hostname = (u) => {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_e) { return u; }
  };

  const approve = async (r, i) => {
    await api.entities.CrawlerSource.create({
      name: hostname(r.base_url),
      base_url: r.base_url,
      adapter: "SITEMAP_JSONLD",
      feed_url: r.feed_url,
      priority: 5,
      crawl_interval_minutes: 720,
      requests_per_minute: 10,
      max_products_per_run: 30,
      default_currency: "USD",
      supplier_score: 85,
      enabled: true,
      status: "ACTIVE",
    });
    setDone((s) => new Set(s).add(i));
    if (onAdded) onAdded();
  };

  const block = async (r, i) => {
    await api.entities.CrawlerSource.create({
      name: hostname(r.base_url),
      base_url: r.base_url,
      adapter: "SITEMAP_JSONLD",
      feed_url: r.robots_url,
      enabled: false,
      status: "DISABLED",
      last_error: r.note,
    });
    setDone((s) => new Set(s).add(i));
    if (onAdded) onAdded();
  };

  return (
    <div className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-3">
      <div>
        <h3 className="font-display font-semibold flex items-center gap-2"><Radar className="w-4 h-4 text-accent-cyan" /> Source discovery & review</h3>
        <p className="text-xs text-text-muted mt-1">
          Paste candidate merchants (up to 10 per scan — brand "Where to Buy / Authorized Partners" pages are great seeds).
          Each is checked against robots.txt and its sitemap; you approve or block each one before activation.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-3 items-start">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"https://www.example-store.com\nhttps://partner-shop.ae"}
          className="bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-xs font-mono md:col-span-2"
        />
        <button
          onClick={detect}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
        >
          <Radar className={cn("w-4 h-4", busy && "animate-pulse")} /> {busy ? "Scanning…" : "Scan candidates"}
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}

      {results && (
        <div className="space-y-1.5">
          {results.map((r, i) => {
            const st = REVIEW_STATUS[r.status] || REVIEW_STATUS.invalid;
            return (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs py-2 border-b border-border-hairline last:border-0">
                <span className={cn("px-2 py-0.5 rounded font-semibold text-[10px] shrink-0", st.cls)}>{st.label}</span>
                <a href={r.base_url} target="_blank" rel="noreferrer" className="font-medium hover:underline truncate max-w-[220px]">{hostname(r.base_url)}</a>
                <span className="text-text-muted truncate max-w-[320px]">{r.note}</span>
                {done.has(i) ? (
                  <span className="text-emerald-600 font-medium ms-auto">✓ reviewed</span>
                ) : r.status === "ok" ? (
                  <button onClick={() => approve(r, i)} className="ms-auto px-2.5 py-1.5 rounded-md bg-noon text-noon-fg font-semibold flex items-center gap-1 hover:opacity-90"><Plus className="w-3 h-3" /> Approve & add</button>
                ) : r.status === "not_allowed" ? (
                  <button onClick={() => block(r, i)} className="ms-auto px-2.5 py-1.5 rounded-md border border-border-hairline text-red-600 flex items-center gap-1 hover:border-red-400/40"><ShieldX className="w-3 h-3" /> Record as blocked</button>
                ) : (
                  <span className="ms-auto text-text-muted">manual setup required — use "Add source"</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}