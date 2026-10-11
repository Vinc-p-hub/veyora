// One Edge Function, several actions: { "action": "...", ...payload }.
import { serve } from "../_shared/runtime.ts";
import ensureRoles from "./handlers/ensure_roles.ts";
import invite from "./handlers/invite.ts";

const ACTIONS: Record<string, (req: Request) => Promise<Response>> = {
  ensure_roles: ensureRoles,
  invite: invite,
};

serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const handler = ACTIONS[String(body.action || "")];
  if (!handler) return Response.json({ error: "Unknown action" }, { status: 400 });
  const { action: _action, ...payload } = body;
  return handler(new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(payload) }));
});
