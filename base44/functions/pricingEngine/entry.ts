// PRICING ENGINE — the single server-side authority for every financial
// calculation in VEYRO. Modes:
//   display  (any user)  : display-only plan config for the storefront (no margins)
//   get      (admin)     : full config + change history
//   update   (admin)     : save config fields, diffed and logged per field
//   simulate (admin)     : supplier price → margin → fees → customer price → plan
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import {
  DEFAULT_PRICING_CONFIG, mergeConfig, resolveRules, computePriceChain,
  computePlanFromConfig, publicDisplayConfig,
} from "../../shared/commerce/rules.js";
import { CURRENCIES, getCountry, convertPrice, round2 } from "../../shared/commerce/pricing.js";

async function ensureConfig(admin) {
  const list = await admin.entities.PricingConfig.filter({ active: true }, "-created_date", 5);
  if (list.length) return list[0];
  return await admin.entities.PricingConfig.create({ ...DEFAULT_PRICING_CONFIG, active: true });
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "display");
    const admin = base44.asServiceRole;

    // Storefront display: plan structure only — never margins or supplier rules.
    if (mode === "display") {
      const doc = await ensureConfig(admin);
      return Response.json({ ok: true, config: publicDisplayConfig(doc) });
    }

    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const doc = await ensureConfig(admin);

    if (mode === "get") {
      const history = await admin.entities.PricingChangeLog.list("-created_date", 50);
      return Response.json({ ok: true, config: mergeConfig(doc), history });
    }

    if (mode === "update") {
      const incoming = mergeConfig(body.config || {});
      const changes = [];
      for (const key of Object.keys(DEFAULT_PRICING_CONFIG)) {
        const oldV = doc[key] === undefined ? null : doc[key];
        const newV = incoming[key] === undefined ? null : incoming[key];
        if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
          changes.push({
            field: key,
            old_value: JSON.stringify(oldV),
            new_value: JSON.stringify(newV),
          });
        }
      }
      await admin.entities.PricingConfig.update(doc.id, incoming);
      if (changes.length) {
        waitUntil(
          admin.entities.PricingChangeLog.bulkCreate(
            changes.map((c) => ({
              admin_email: user.email,
              field: c.field,
              old_value: c.old_value,
              new_value: c.new_value,
              details: "Updated from the Pricing & Business Rules module",
            }))
          ).catch(() => {})
        );
      }
      return Response.json({ ok: true, changed: changes.length, config: incoming });
    }

    if (mode === "simulate") {
      const config = mergeConfig(doc);
      const supplierPrice = Math.max(0, Number(body.supplier_price) || 0);
      const countryCode = String(body.country_code || "US").toUpperCase().slice(0, 2);
      const planId = body.plan_id ? String(body.plan_id) : config.default_plan_id;
      const rules = resolveRules(config, {
        category: body.category || null,
        country_code: countryCode,
        source_id: body.source_id || null,
      });
      const withFee = computePriceChain(supplierPrice, rules, { installments: true });
      const withoutFee = computePriceChain(supplierPrice, rules, { installments: false });
      const plan = computePlanFromConfig(withFee.customer_price, config, planId);
      // Local currency view for the selected country
      const country = getCountry(countryCode);
      const currency = CURRENCIES[country.currency] || CURRENCIES.USD;
      const local = {
        currency: currency.code,
        symbol: currency.symbol,
        customer_price: convertPrice(withFee.customer_price, currency.code),
        first_payment: convertPrice(plan.first_payment, currency.code),
        next_amount: convertPrice(plan.next_amount, currency.code),
        total: convertPrice(plan.total, currency.code),
        shipping_fee: round2((rules.shipping_fee || 0)),
        tax_rate: rules.tax_rate,
      };
      return Response.json({ ok: true, rules, chain: withFee, chain_pay_now: withoutFee, plan, local });
    }

    return Response.json({ error: "Unknown mode" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Pricing engine failed" }, { status: 500 });
  }
}