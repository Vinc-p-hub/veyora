// AUTOMATIC crawler orchestrator — called every 5 minutes by pg_cron (see migration), or by an admin.
// Unauthenticated calls must carry the x-cron-secret header matching the secret stored in public.app_secrets.
import { createContext } from "../../_shared/runtime.ts";
import { orchestrate } from "../../_shared/catalog/scheduler.js";

export default async function handler(req: Request): Promise<Response> {
  const ctx = await createContext(req);
  const body = await req.json().catch(() => ({}));
  if (!ctx.user) {
    const { data } = await ctx.db.from("app_secrets").select("value").eq("key", "cron_secret").maybeSingle();
    const sent = req.headers.get("x-cron-secret") || "";
    if (!data?.value || sent !== data.value) return Response.json({ error: "Unauthorized" }, { status: 401 });
  } else if (ctx.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const maxJobs = Math.min(Number(body.max_jobs) || 25, 50);
  const result = await orchestrate({ admin: ctx.admin, maxJobs });
  return Response.json({ ok: true, ...result });
}
