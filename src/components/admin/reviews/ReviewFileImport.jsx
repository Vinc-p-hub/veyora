import React, { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

// Bulk import of real reviews from a file (CSV, Excel or JSON). The file is
// uploaded, the backend extracts every row and stores it as a review on the
// product. Rows without review text are skipped — nothing is ever invented.
export default function ReviewFileImport({ product, onImported }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [sourceName, setSourceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const run = async () => {
    if (!file) return setError("Choose a file first.");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { file_url } = await api.integrations.Core.UploadPrivateFile({ file });
      const res = await api.functions.invoke("reviewImport", {
        product_id: product.id,
        file_url,
        source_name: sourceName.trim(),
      });
      if (res.data?.error) throw new Error(res.data.error);
      const imported = res.data?.imported || 0;
      const skipped = res.data?.skipped || 0;
      setResult(`Imported ${imported} review(s)${skipped ? ` · ${skipped} skipped (no text)` : ""}.`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported?.(`${imported} review(s) imported on ${product.name}.`);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-hairline text-xs font-semibold hover:border-accent-cyan/40 transition"
      >
        <FileUp className="w-3.5 h-3.5" /> Import reviews from a file
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-accent-cyan/40 bg-surface-primary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Import reviews from a file</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text-primary">
          Close
        </button>
      </div>
      <p className="text-[11px] text-text-muted leading-snug">
        CSV, Excel (.xlsx) or JSON — one review per row with the columns{" "}
        <span className="font-medium">author, rating, text, source_name, review_date, review_url</span>. Only the
        <span className="font-medium"> text</span> column is required.
      </p>
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
    </div>
  );
}