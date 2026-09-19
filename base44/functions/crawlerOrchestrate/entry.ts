// AUTOMATIC crawler orchestrator — invoked by the cron automation every 5
// minutes (function.jsonc). Admins may also trigger it manually via the
// Super Admin console; unauthenticated calls must carry the automation key.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { AUTOMATION_KEY, orchestrate } from "../../shared/catalog/scheduler.js";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    const body = await req.json().catch(() => ({}));
    const args = body.args || {};
    if (!user) {
      if (String(args.automation_key || "") !== AUTOMATION_KEY) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const maxJobs = Math.min(Number(body.max_jobs) || Number(args.max_jobs) || 25, 50);
    const result = await orchestrate({ admin: base44.asServiceRole, maxJobs });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message || "Orchestration failed" }, { status: 500 });
  }
}