import React, { useRef, useState } from "react";
import { FileUp, Loader2, Download } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

// Downloadable CSV template (modèle): the exact columns the importer expects,
// with two example rows. Fill it in, delete the examples and re-upload it as-is.
const TEMPLATE_ROWS = [
  ["product", "author", "rating", "text", "source_name", "review_date", "review_url"],
  ["iphone-16-pro-256gb", "Marie L.", "5", "Excellent produit, livraison rapide", "Keychron", "2026-03-11", "https://exemple.com/avis/1"],
  ["galaxy-s25-ultra-512gb", "Ali R.", "4", "Très bon appareil, un peu cher", "Keychron", "2026-02-02", ""],
];

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function downloadTemplate() {
  const csv = "\uFEFF" + TEMPLATE_ROWS.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "veyro-reviews-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Catalogue-wide review import: ONE file, every row naming its own product.
// Rows are matched on slug, exact product name or SKU; unmatched references are
// reported back instead of being dropped silently. Nothing is ever invented.
export default function BulkReviewImport() {
  const [file, setFile] = useState(null);
  const [sourceName, setSourceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unmatched, setUnmatched] = useState([]);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const run = async () => {
    if (!file) return setError("Choose a file first.");
    setBusy(true);
    setError("");
    setResult(null);
    setUnmatched([]);
    try {
      const { file_url } = await api.integrations.Core.UploadPublicFile({ file });
      const res = await api.functions.invoke("reviewImport", {
        file_url,
        source_name: sourceName.trim(),
      });
      const data = res.data || {};
      if (data.error) {
        setUnmatched(data.unmatched || []);
        throw new Error(data.error);
      }
      const imported = data.imported || 0;
      const skipped = data.skipped || 0;
      const missed = data.unmatched_count || 0;
      setResult(
        `Imported ${imported} review(s)${skipped ? ` · ${skipped} skipped (no text)` : ""}${
          missed ? ` · ${missed} row(s) on unknown products` : ""
        }.`
      );
      setUnmatched(data.unmatched || []);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface-card border border-border-hairline rounded-lg p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display font-semibold text-sm">Import reviews for the whole catalogue</h2>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border-hairline text-xs font-semibold hover:border-accent-cyan/40 transition"
        >
          <Download className="w-3.5 h-3.5" /> Download the CSV template
        </button>
      </div>
      <div>
        <p className="text-[11px] text-text-muted leading-snug">
          One file, one review per row, each row naming its product in the{" "}
          <span className="font-medium">product</span> column — its{" "}
          <span className="font-medium">slug</span> (recommended, e.g. <span className="font-mono">iphone-16-pro-256gb</span>),
          its exact <span className="font-medium">name</span> or its <span className="font-medium">SKU</span>. Other
          columns: <span className="font-medium">author, rating, text, source_name, review_date, review_url</span> — only{" "}
          <span className="font-medium">text</span> and <span className="font-medium">product</span> are required. Up to
          500 rows per file.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs"
        />
        <input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder="Partner source for the whole file (e.g. Keychron)"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border-hairline text-xs"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && <p className="text-xs text-emerald-600">{result}</p>}
      {unmatched.length > 0 && (
        <div className="rounded-lg bg-surface-primary p-3 text-[11px] text-text-muted">
          Products not found in the catalogue:{" "}
          <span className="font-mono text-text-primary">{unmatched.join(", ")}</span>
        </div>
      )}
      <button
        onClick={run}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-noon text-noon-fg text-xs font-semibold hover:opacity-90",
          busy && "opacity-50"
        )}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
        {busy ? "Importing…" : "Upload & import"}
      </button>
    </section>
  );
}