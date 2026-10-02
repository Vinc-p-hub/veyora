// Public list of the payment methods the storefront may offer.
//
// Only providers switched on in the back office (and fully configured) are
// returned — and never anything secret: just the id, label and coverage, which
// the checkout, the payment-methods page and the footer render.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import { getProvider, isProviderImplemented } from "../../shared/payments/catalog.js";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const providers = [];

    // NexaPay is wired through the app's environment secrets rather than the vault.
    if (secrets.get("NEXAPAY_API_KEY") && secrets.get("NEXAPAY_SECRET_KEY")) {
      providers.push({ id: "nexapay", label: "NexaPay", region: "Global" });
    }

    const rows = await base44.asServiceRole.entities.PspCredential.filter({ enabled: true });
    for (const row of rows) {
      // Never offer a method the platform cannot actually complete a payment with.
      if (!row.configured || !isProviderImplemented(row.provider)) continue;
      if (providers.some((p) => p.id === row.provider)) continue;
      const meta = getProvider(row.provider);
      providers.push({
        id: row.provider,
        label: row.label || meta?.label || row.provider,
        region: meta?.region || "",
      });
    }

    return Response.json({ ok: true, providers });
  } catch (error) {
    return Response.json({ error: error.message || "Provider list failed" }, { status: 500 });
  }
}