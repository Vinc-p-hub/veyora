import React, { useCallback, useEffect, useState } from "react";
import { Github, RefreshCw, Star, GitPullRequest, ExternalLink, Lock } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

// GitHub integration — shared connector. One click synchronizes the connected
// account's repositories and their open (pending-validation) pull requests,
// both persisted server-side in GithubProject / GithubPullRequest.
export default function GithubPage() {
  const [projects, setProjects] = useState(null);
  const [prs, setPrs] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);

  const load = useCallback(() => {
    api.entities.GithubProject.list("-pushed_at", 200)
      .then((rows) => setProjects(rows))
      .catch(() => setProjects([]));
    api.entities.GithubPullRequest.filter({ state: "OPEN" }, "-updated_at", 200)
      .then((rows) => setPrs(rows))
      .catch(() => setPrs([]));
  }, []);

  useEffect(load, [load]);

  const sync = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const res = await api.functions.invoke("githubSync", {});
      setStatus(
        `${res.data.repos} repositories synced · ${res.data.open_prs} open pull requests`
      );
      load();
    } catch (e) {
      setStatus(e?.response?.data?.error || "Sync failed — check the GitHub connection.");
    } finally {
      setSyncing(false);
    }
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Github className="w-5 h-5" /> GitHub
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Repositories and pull requests pending validation, synced from the connected GitHub account.
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="px-4 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Synchronize now"}
        </button>
      </div>

      {status && (
        <p className={cn("rounded-lg p-3 text-sm", status.includes("failed") ? "bg-red-50 text-red-600" : "bg-surface-primary text-text-muted")}>
          {status}
        </p>
      )}

      {/* Open pull requests — pending validation */}
      <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-accent-cyan" />
          Pull requests pending validation
          {prs && <span className="text-xs text-text-muted font-normal">({prs.length})</span>}
        </h2>
        {prs === null ? (
          <div className="h-20 bg-surface-primary rounded-lg animate-pulse" />
        ) : prs.length === 0 ? (
          <p className="text-sm text-text-muted">
            No open pull request{projects === null ? "" : " — launch a synchronization to import them"}.
          </p>
        ) : (
          <div className="space-y-3">
            {prs.map((pr) => (
              <div key={pr.id} className="flex items-start gap-3 border-t border-border-hairline pt-3 first:border-0 first:pt-0">
                <GitPullRequest className="w-4 h-4 mt-0.5 text-accent-cyan shrink-0" />
                <div className="min-w-0 flex-1">
                  <a href={pr.html_url} target="_blank" rel="noreferrer"
                    className="text-sm font-medium hover:text-accent-cyan flex items-center gap-1.5">
                    {pr.title} <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                  <div className="text-xs text-text-muted mt-0.5 flex flex-wrap items-center gap-x-2">
                    <span className="font-mono">{pr.project_full_name}#{pr.number}</span>
                    <span>· by {pr.author}</span>
                    <span>· opened {fmtDate(pr.created_at)}</span>
                    {pr.draft && (
                      <span className="inline-flex items-center gap-1 text-text-muted/80">
                        <Lock className="w-3 h-3" /> draft
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved repositories */}
      <section className="bg-surface-card border border-border-hairline rounded-lg p-5">
        <h2 className="font-display font-semibold text-lg mb-4">
          Repositories
          {projects && <span className="text-xs text-text-muted font-normal"> ({projects.length} saved)</span>}
        </h2>
        {projects === null ? (
          <div className="h-40 bg-surface-primary rounded-lg animate-pulse" />
        ) : projects.length === 0 ? (
          <p className="text-sm text-text-muted">No repository saved yet — launch a synchronization.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-text-muted border-b border-border-hairline">
                  <th className="py-2 pe-4">Repository</th>
                  <th className="py-2 px-3">Language</th>
                  <th className="py-2 px-3">Stars</th>
                  <th className="py-2 px-3">Open PRs</th>
                  <th className="py-2 px-3">Last push</th>
                  <th className="py-2 ps-3"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-border-hairline last:border-0">
                    <td className="py-2.5 pe-4">
                      <div className="flex items-center gap-2">
                        {p.private ? <Lock className="w-3.5 h-3.5 text-text-muted" /> : <Github className="w-3.5 h-3.5 text-text-muted" />}
                        <span className="font-medium">{p.full_name}</span>
                      </div>
                      {p.description && <div className="text-xs text-text-muted truncate max-w-md">{p.description}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-text-muted">{p.language || "—"}</td>
                    <td className="py-2.5 px-3 text-text-muted flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" /> {p.stars || 0}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.open_prs > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-accent-cyan/10 text-accent-cyan text-xs font-mono">{p.open_prs}</span>
                      ) : (
                        <span className="text-text-muted text-xs">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-text-muted">{fmtDate(p.pushed_at)}</td>
                    <td className="py-2.5 ps-3 text-right">
                      <a href={p.html_url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-accent-cyan">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}