// Crawler queue endpoint (Super Admin "Process queue now" button).
// Core logic lives in the shared worker module, also used by the automatic orchestrator.
import { createContext, waitUntil } from "../../_shared/runtime.ts";
import { processQueueBatch } from "../../_shared/catalog/worker.js";

export default async function handler(req: Request): Promise<Response> {
  try {
    const __ctx = await createContext(req);
    const user = __ctx.user;
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const maxJobs = Math.min(Number(body.max_jobs) || 25, 50);
    const result = await processQueueBatch({
      admin: __ctx.admin,
      actor: { id: user.id, email: user.email },
      maxJobs,
      // Scoped run: only this source's jobs are claimed, other sites stay queued.
      sourceId: body.source_id || null,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message || "Queue processing failed" }, { status: 500 });
  }
}