import React from "react";
import CrawlerPanel from "@/components/admin/CrawlerPanel";

// Full crawler source management (URLs, adapters, frequency, state, queue,
// diagnostics, failed-job recovery) lives in the shared CrawlerPanel.
export default function SourcesPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-xl md:text-2xl">Crawler sources</h1>
      <CrawlerPanel />
    </div>
  );
}