// One Edge Function, several actions: { "action": "...", ...payload }.
import { serve } from "../_shared/runtime.ts";
import runSource from "./handlers/run_source.ts";
import processQueue from "./handlers/process_queue.ts";
import normalize from "./handlers/normalize.ts";
import autodetect from "./handlers/autodetect.ts";
import imageFill from "./handlers/image_fill.ts";
import orchestrate from "./handlers/orchestrate.ts";

const ACTIONS: Record<string, (req: Request) => Promise<Response>> = {
  run_source: runSource,
  process_queue: processQueue,
  normalize: normalize,
  autodetect: autodetect,
  image_fill: imageFill,
  orchestrate: orchestrate,
};

serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const handler = ACTIONS[String(body.action || "")];
  if (!handler) return Response.json({ error: "Unknown action" }, { status: 400 });
  const { action: _action, ...payload } = body;
  return handler(new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(payload) }));
});
