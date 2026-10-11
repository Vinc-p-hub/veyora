// One Edge Function, several actions: { "action": "...", ...payload }.
import { serve } from "../_shared/runtime.ts";
import submit from "./handlers/submit.ts";
import report from "./handlers/report.ts";
import moderate from "./handlers/moderate.ts";
import invite from "./handlers/invite.ts";
import importReviews from "./handlers/import.ts";

const ACTIONS: Record<string, (req: Request) => Promise<Response>> = {
  submit: submit,
  report: report,
  moderate: moderate,
  invite: invite,
  import: importReviews,
};

serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const handler = ACTIONS[String(body.action || "")];
  if (!handler) return Response.json({ error: "Unknown action" }, { status: 400 });
  const { action: _action, ...payload } = body;
  return handler(new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(payload) }));
});
