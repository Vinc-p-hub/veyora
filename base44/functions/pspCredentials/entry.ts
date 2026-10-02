// Back-office credential vault for the payment providers.
//
// The stored keys are NEVER readable by any app user: the PspCredential entity
// has read=false, so the only way in or out is this function. It returns the
// catalog plus masked previews (last 4 characters) and writes new values with
// the service role. Admin-only.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { PSP_CATALOG, getProvider, isProviderImplemented } from "../../shared/payments/catalog.js";

const mask = (value) => (value ? `••••${String(value).slice(-4)}` : "");

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const admin = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    const saved = await admin.entities.PspCredential.list(null, 200);
    const byProvider = new Map(saved.map((r) => [r.provider, r]));

    const listPayload = () =>
      PSP_CATALOG.map((p) => {
        const row = byProvider.get(p.id);
        return {
          id: p.id,
          label: p.label,
          region: p.region,
          fields: p.fields,
          // False = the catalog entry exists but its API contract is not wired
          // yet, so it cannot be offered to customers.
          implemented: isProviderImplemented(p.id),
          enabled: !!row?.enabled,
          mode: row?.mode || "TEST",
          configured: !!row?.configured,
          hints: row?.hints || {},
          updated_by: row?.updated_by || null,
        };
      });

    if (action === "disconnect") {
      const provider = getProvider(body.provider);
      const row = provider ? byProvider.get(provider.id) : null;
      if (row) {
        await admin.entities.PspCredential.delete(row.id);
        await admin.entities.AuditLog.create({
          actor_email: user.email,
          actor_id: user.id,
          action: "PSP_CREDENTIAL_DELETE",
          target_type: "psp_credential",
          target_id: row.id,
          details: `${provider.label} credentials disconnected`,
        });
      }
      return Response.json({ ok: true, providers: listPayload() });
    }

    if (action === "save") {
      const provider = getProvider(body.provider);
      if (!provider) return Response.json({ error: "Unknown payment provider" }, { status: 400 });
      const existing = byProvider.get(provider.id);
      const incoming = body.credentials && typeof body.credentials === "object" ? body.credentials : {};

      // An empty field keeps the stored value, so one key can be rotated alone.
      const credentials = { ...(existing?.credentials || {}) };
      for (const field of provider.fields) {
        const raw = incoming[field.key];
        if (typeof raw === "string" && raw.trim() !== "") credentials[field.key] = raw.trim();
      }

      const hints = {};
      for (const field of provider.fields) {
        if (credentials[field.key]) hints[field.key] = mask(credentials[field.key]);
      }
      const configured = provider.fields.every((f) => !f.required || credentials[f.key]);
      const enabled = body.enabled !== undefined ? !!body.enabled : !!existing?.enabled;
      const mode = body.mode === "LIVE" ? "LIVE" : "TEST";

      const payload = {
        provider: provider.id,
        label: provider.label,
        enabled: enabled && configured && isProviderImplemented(provider.id),
        mode,
        credentials,
        hints,
        configured,
        updated_by: user.email,
      };

      if (existing) await admin.entities.PspCredential.update(existing.id, payload);
      else await admin.entities.PspCredential.create(payload);

      await admin.entities.AuditLog.create({
        actor_email: user.email,
        actor_id: user.id,
        action: "PSP_CREDENTIAL_UPDATE",
        target_type: "psp_credential",
        target_id: existing?.id || provider.id,
        details: `${provider.label} ${mode} credentials saved (${configured ? "complete" : "incomplete"})`,
      });

      return Response.json({ ok: true, providers: listPayload() });
    }

    return Response.json({ ok: true, providers: listPayload() });
  } catch (error) {
    return Response.json({ error: error.message || "Credential vault failed" }, { status: 500 });
  }
}