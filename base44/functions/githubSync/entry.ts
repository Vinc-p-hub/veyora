// githubSync — admin-only sync via the shared GitHub connector:
// 1. lists the connected account's repositories and upserts them into
//    GithubProject (anchor: full_name),
// 2. lists the OPEN pull requests of the most recently pushed repos
//    ("pending validation") and upserts them into GithubPullRequest
//    (anchor: github_id). PRs that are no longer open are marked CLOSED.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

const GH = "https://api.github.com";
const MAX_REPO_PAGES = 3; // up to 300 repos
const MAX_PR_REPOS = 50; // most recently pushed repos scanned for open PRs
const MAX_PRS_PER_REPO = 50;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("github");
    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "veyro-github-sync",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const admin = base44.asServiceRole;

    // --- 1. Repositories (sorted by last push) ---
    const repos = [];
    for (let page = 1; page <= MAX_REPO_PAGES; page++) {
      const res = await fetch(`${GH}/user/repos?per_page=100&sort=pushed&page=${page}`, { headers: ghHeaders });
      if (!res.ok) return Response.json({ error: `GitHub API error ${res.status}` }, { status: 502 });
      const batch = await res.json();
      repos.push(...batch);
      if (!Array.isArray(batch) || batch.length < 100) break;
    }

    // --- 2. Open PRs ("pending validation") for the active repos ---
    const prRepos = repos.slice(0, MAX_PR_REPOS);
    const openPrs = [];
    const openPrsByRepo = new Map();
    for (const r of prRepos) {
      const res = await fetch(`${GH}/repos/${r.full_name}/pulls?state=open&per_page=${MAX_PRS_PER_REPO}`, { headers: ghHeaders });
      if (!res.ok) continue; // one unreadable repo never blocks the sync
      const prs = await res.json();
      if (!Array.isArray(prs)) continue;
      openPrsByRepo.set(r.full_name, prs.length);
      for (const pr of prs) {
        openPrs.push({
          github_id: String(pr.id),
          project_full_name: r.full_name,
          number: pr.number,
          title: pr.title,
          body: String(pr.body || "").slice(0, 2000),
          author: (pr.user && pr.user.login) || "",
          author_avatar: (pr.user && pr.user.avatar_url) || "",
          draft: !!pr.draft,
          html_url: pr.html_url,
          state: "OPEN",
          created_at: pr.created_at || "",
          updated_at: pr.updated_at || "",
        });
      }
    }

    // --- 3. Upsert projects (anchor: full_name) ---
    const existingProjects = await admin.entities.GithubProject.list(null, 500);
    const projectByName = new Map(existingProjects.map((p) => [p.full_name, p]));
    const scannedNames = new Set(prRepos.map((r) => r.full_name));
    const now = new Date().toISOString();
    const projectsToCreate = [];
    const projectsToUpdate = [];
    for (const r of repos) {
      const fields = {
        full_name: r.full_name,
        name: r.name,
        owner: (r.owner && r.owner.login) || "",
        description: r.description || "",
        html_url: r.html_url,
        private: !!r.private,
        language: r.language || "",
        stars: r.stargazers_count || 0,
        pushed_at: r.pushed_at || "",
        synced_at: now,
      };
      if (scannedNames.has(r.full_name)) fields.open_prs = openPrsByRepo.get(r.full_name) || 0;
      const existing = projectByName.get(r.full_name);
      if (existing) projectsToUpdate.push({ id: existing.id, ...fields });
      else projectsToCreate.push(fields);
    }
    if (projectsToCreate.length) await admin.entities.GithubProject.bulkCreate(projectsToCreate);
    for (let i = 0; i < projectsToUpdate.length; i += 500) {
      await admin.entities.GithubProject.bulkUpdate(projectsToUpdate.slice(i, i + 500));
    }

    // --- 4. Upsert PRs (anchor: github_id) + close stale ones ---
    const existingPrs = await admin.entities.GithubPullRequest.list(null, 1000);
    const prById = new Map(existingPrs.map((p) => [p.github_id, p]));
    const currentPrIds = new Set(openPrs.map((p) => p.github_id));
    const prsToCreate = [];
    const prsToUpdate = [];
    const prsToClose = [];
    for (const pr of openPrs) {
      const existing = prById.get(pr.github_id);
      if (existing) prsToUpdate.push({ id: existing.id, ...pr });
      else prsToCreate.push(pr);
    }
    for (const p of existingPrs) {
      // only PRs of repos scanned this run can be judged "no longer open"
      if (p.state === "OPEN" && scannedNames.has(p.project_full_name) && !currentPrIds.has(p.github_id)) {
        prsToClose.push({ id: p.id, state: "CLOSED" });
      }
    }
    if (prsToCreate.length) await admin.entities.GithubPullRequest.bulkCreate(prsToCreate);
    for (let i = 0; i < prsToUpdate.length; i += 500) {
      await admin.entities.GithubPullRequest.bulkUpdate(prsToUpdate.slice(i, i + 500));
    }
    if (prsToClose.length) {
      for (let i = 0; i < prsToClose.length; i += 500) {
        await admin.entities.GithubPullRequest.bulkUpdate(prsToClose.slice(i, i + 500));
      }
    }

    return Response.json({
      ok: true,
      repos: repos.length,
      projects_created: projectsToCreate.length,
      projects_updated: projectsToUpdate.length,
      open_prs: openPrs.length,
      prs_closed: prsToClose.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || "GitHub sync failed" }, { status: 500 });
  }
}