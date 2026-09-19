// Crawler queue endpoint (Super Admin "Process queue now" button).
// Core logic lives in the shared worker module, also used by the automatic orchestrator.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { processQueueBatch } from "../../shared/catalog/worker.js";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const maxJobs = Math.min(Number(body.max_jobs) || 25, 50);
    const result = await processQueueBatch({
      admin: base44.asServiceRole,
      actor: { id: user.id, email: user.email },
      maxJobs,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message || "Queue processing failed" }, { status: 500 });
  }
}