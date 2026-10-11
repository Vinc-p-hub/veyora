// Crawler discovery endpoint (Super Admin "Run now" button).
// Core logic lives in the shared discover module, also used by the automatic orchestrator.
import { createContext, waitUntil } from "../../_shared/runtime.ts";
import { runDiscovery } from "../../_shared/catalog/discover.js";

export default async function handler(req: Request): Promise<Response> {
  try {
    const __ctx = await createContext(req);
    const user = __ctx.user;
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const admin = __ctx.admin;
    const sources = await admin.entities.CrawlerSource.list(null, 200);
    const source = sources.find((s) => s.id === body.source_id);
    if (!source) return Response.json({ error: "Source not found" }, { status: 404 });
    if (!source.enabled || source.status === "DISABLED") {
      return Response.json({ error: "Source is disabled" }, { status: 400 });
    }
    const result = await runDiscovery({ admin, source, actor: { id: user.id, email: user.email } });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message || "Crawler run failed" }, { status: 500 });
  }
}