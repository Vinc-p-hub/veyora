// Lists the Supabase workspace projects via the connected Supabase connector.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    const res = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return Response.json({ error: `Supabase API error ${res.status}` }, { status: 502 });
    }
    const projects = await res.json();
    return Response.json({
      ok: true,
      count: projects.length,
      projects: (Array.isArray(projects) ? projects : []).map((p) => ({
        id: p.id,
        ref: p.ref,
        name: p.name,
        region: p.region,
        status: p.status,
        created_at: p.created_at,
        organization_id: p.organization_id,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Failed to list Supabase projects" }, { status: 500 });
  }
}