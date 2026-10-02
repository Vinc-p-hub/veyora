import React from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import useAdminDashboard from "@/hooks/useAdminDashboard";
import DashboardKpis from "@/components/admin/dashboard/DashboardKpis";
import SalesPerformanceCard from "@/components/admin/dashboard/SalesPerformanceCard";
import CrawlerVolumeCard from "@/components/admin/dashboard/CrawlerVolumeCard";
import ConnectionsCard from "@/components/admin/dashboard/ConnectionsCard";

export default function Overview() {
  const { data, loading, lastUpdate, reload } = useAdminDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl">Live dashboard</h1>
          <p className="text-xs text-text-muted flex items-center gap-1.5 mt-1">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
            </span>
            Real time — updates automatically{lastUpdate ? ` · last refresh ${lastUpdate.toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="px-4 py-2 rounded-lg border border-border-hairline text-sm font-semibold hover:border-accent-cyan/40 flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
          </button>
          <Link to="/admin/sources" className="px-4 py-2 rounded-lg bg-noon text-noon-fg text-sm font-semibold">Open crawler console</Link>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-card border border-border-hairline rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <DashboardKpis data={data} />
          <div className="grid xl:grid-cols-2 gap-4">
            <SalesPerformanceCard data={data} />
            <CrawlerVolumeCard data={data} />
            <ConnectionsCard data={data} />
          </div>
        </>
      )}
    </div>
  );
}