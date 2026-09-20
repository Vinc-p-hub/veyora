// Server-side checkout revalidation: best eligible offer per product, authoritative
// pricing (central PricingConfig rules: margin, fees, shipping, tax, currency),
// installment plan and immutable price snapshot. The client NEVER decides prices.
// Before every order: last supplier check on price, stock and availability —
// stale supplier data triggers a priority live re-check job (never a block:
// VEYRO ships worldwide and its warehouse stock covers unavailable suppliers).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import {
  CURRENCIES, getCountry, convertPrice, round2, selectBestOffer,
} from "../../shared/commerce/pricing.js";
import {
  mergeConfig, resolveRules, computePriceChain, computePlanFromConfig,
} from "../../shared/commerce/rules.js";
import { selectFulfillmentSource, recordStockMovement } from "../../shared/commerce/stock.js";

const SUPPLIER_FRESH_MS = 24 * 60 * 60 * 1000; // supplier data older than 24h = stale

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const cartItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const countryCode = String(body.country_code || "US").toUpperCase().slice(0, 2);
    const planId = String(body.plan_id || "plan_5");
    // commit: final step before the order is written — decrements the internal
    // VEYRO allocation and the real VEYRO physical stock for VEYRO-fulfilled lines.
    const commit = body.commit === true;
    const orderNumber = typeof body.order_number === "string" ? body.order_number.slice(0, 24) : "";
    const admin = base44.asServiceRole;
    const now = new Date();

    if (!cartItems.length) return Response.json({ error: "Cart empty" }, { status: 400 });

    const products = await admin.entities.Product.list(null, 500);
    const allOffers = await admin.entities.Offer.list(null, 500);
    const country = getCountry(countryCode);
    const currency = CURRENCIES[country.currency] || CURRENCIES.USD;

    // Central pricing rules — every order price derives from the Super Admin config.
    const cfgDocs = await admin.entities.PricingConfig.filter({ active: true }, "-created_date", 5);
    const config = mergeConfig(cfgDocs[0] || {});
    const installments = planId !== "pay_now";

    let subtotalUsd = 0;
    const warnings = [];
    const items = [];
    const snapshotItems = [];
    const supplierRecheckJobs = [];

    for (const line of cartItems) {
      const qty = Math.max(1, Math.min(Number(line.qty) || 1, 10));
      const product = products.find((p) => p.id === line.product_id && p.status === "PUBLISHED");
      if (!product) continue;
      // VEYRO ships worldwide — no country restriction ever blocks a cart line.
      const offers = allOffers.filter((o) => o.product_id === product.id);
      const best = offers.length ? selectBestOffer(offers, countryCode) : null;

      // --- last supplier verification before the order ---
      let supplierFresh = true;
      if (!best) {
        supplierFresh = false;
      } else if (best.stale || !best.last_checked || now - new Date(best.last_checked) > SUPPLIER_FRESH_MS) {
        supplierFresh = false;
        supplierRecheckJobs.push({
          type: "UPDATE_PRICE",
          source_id: best.source_id,
          product_id: product.id,
          url: best.source_url,
          priority: 2,
          status: "QUEUED",
          scheduled_at: now.toISOString(),
        });
      }

      const rules = resolveRules(config, {
        category: product.category,
        country_code: countryCode,
        source_id: best ? best.source_id : product.source_id,
      });
      const unitUsd = best
        ? computePriceChain(best.source_price, rules, { installments }).customer_price
        : product.customer_price;
      const listedUsd = product.customer_price;
      // No line is ever blocked: VEYRO ships worldwide and its warehouse stock
      // (internal +10 sellable surplus per product) covers the order whenever
      // the partner supplier is out of stock.
      // FULFILLMENT_SOURCE: VEYRO's own physical stock ships first when enough
      // unreserved units exist — otherwise the verified partner supplier ships.
      const fulfillmentSource = selectFulfillmentSource(product, qty);
      const lineTotalUsd = round2(unitUsd * qty);
      subtotalUsd = round2(subtotalUsd + lineTotalUsd);
      items.push({
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        image_url: product.image_url,
        qty,
        unit_price: unitUsd,
        line_total: lineTotalUsd,
        stock_status: best ? best.stock_status : product.stock_status,
        delivery_days: best && best.delivery_days ? best.delivery_days : product.delivery_days,
        shipping_cost: best ? best.shipping_cost || 0 : 0,
        seller_id: best ? best.seller_id : null,
        seller_name: best ? best.seller_name || product.source_name : product.source_name,
        changed: Math.abs(unitUsd - listedUsd) > 0.01,
        available: true,
        supplier_fresh: supplierFresh,
        fulfillment_source: fulfillmentSource,
      });
      snapshotItems.push({
        product_id: product.id,
        name: product.name,
        offer_id: best ? best.id : null,
        source_id: best ? best.source_id : (product.source_id || null),
        source_price: best ? best.source_price : product.source_price,
        supplier_currency: best ? best.supplier_currency || "USD" : "USD",
        seller_id: best ? best.seller_id : null,
        seller_name: best ? best.seller_name || product.source_name : product.source_name,
        seller_url: best ? best.source_url : null,
        stock_status: best ? best.stock_status : product.stock_status,
        delivery_days: best && best.delivery_days ? best.delivery_days : product.delivery_days,
        shipping_cost: best ? best.shipping_cost || 0 : 0,
        variant: product.variant_info || null,
        margin_percent: rules.margin_percent ?? null,
        pricing_rules: JSON.parse(JSON.stringify(rules || {})),
        unit_customer_price_usd: unitUsd,
        fulfillment_source: fulfillmentSource,
        qty,
        line_total_usd: lineTotalUsd,
      });
    }

    const countryRule = config.country_rules[countryCode] || {};
    // VEYRO worldwide shipping: flat $14 when no explicit country fee is
    // configured in the pricing rules — a seller without its own shipping
    // price never ships for free by accident.
    const shippingUsd = round2(
      typeof countryRule.shipping_fee === "number" ? countryRule.shipping_fee : 14
    );
    const taxRate = typeof countryRule.tax_rate === "number" ? countryRule.tax_rate : country.taxRate;
    const taxUsd = round2(subtotalUsd * taxRate);
    const totalUsd = round2(subtotalUsd + shippingUsd + taxUsd);
    const rate = currency.rate;

    const totals = {
      subtotal: convertPrice(subtotalUsd, currency.code),
      shipping: convertPrice(shippingUsd, currency.code),
      tax: convertPrice(taxUsd, currency.code),
      total: convertPrice(totalUsd, currency.code),
    };
    const plan = computePlanFromConfig(totals.total, config, planId);

    // Trigger the priority supplier re-checks without blocking the response.
    if (supplierRecheckJobs.length) {
      waitUntil(admin.entities.CrawlerJob.bulkCreate(supplierRecheckJobs).catch(() => {}));
    }

    // Commit: decrement the internal VEYRO sellable allocation and the REAL
    // VEYRO physical stock (VEYRO-fulfilled lines) before the order is
    // written. Orders are never refused — warehouse stock (+10 surplus per
    // product) covers unavailable suppliers. The supplier stock never moves.
    const productUpdateSets = [];
    const stockMovements = [];
    if (commit) {
      for (const it of items) {
        const product = products.find((p) => p.id === it.product_id);
        if (!product) continue;
        const allocated = Number(product.veyro_allocated_stock) || 0;
        if (allocated > 0) {
          const current = typeof product.available_to_sell === "number" ? product.available_to_sell : allocated;
          // The internal allocation decrements but never blocks the order —
          // the VEYRO warehouse surplus covers whatever the supplier lacks.
          product.available_to_sell = Math.max(0, current - it.qty);
          productUpdateSets.push({ id: product.id, available_to_sell: product.available_to_sell });
        }
        // VEYRO-owned physical inventory: real decrement + immutable movement log.
        if (it.fulfillment_source === "VEYRO") {
          const oldStock = Number(product.veyro_stock) || 0;
          const newStock = Math.max(0, oldStock - it.qty);
          product.veyro_stock = newStock;
          productUpdateSets.push({ id: product.id, veyro_stock: newStock });
          stockMovements.push({
            product_id: product.id,
            product_name: it.name,
            qty: -it.qty,
            old_stock: oldStock,
            new_stock: newStock,
            reason: "ORDER_FULFILLMENT",
            order_number: orderNumber,
          });
        }
      }
      // One update per product (a product may appear on several lines).
      const byId = new Map();
      for (const u of productUpdateSets) byId.set(u.id, { ...(byId.get(u.id) || {}), ...u });
      if (byId.size) {
        await admin.entities.Product.bulkUpdate([...byId.values()]);
      }
      for (const m of stockMovements) {
        waitUntil(recordStockMovement(admin, m));
      }
    }

    const snapshot = {
      created_at: new Date().toISOString(),
      country: countryCode,
      currency: currency.code,
      rate,
      subtotal_usd: subtotalUsd,
      shipping_usd: shippingUsd,
      tax_usd: taxUsd,
      total_usd: totalUsd,
      totals_local: totals,
      plan,
      items: snapshotItems,
      note: "Immutable OrderPriceSnapshot — future source price or pricing-rule changes never modify this order.",
    };

    return Response.json({
      ok: true,
      currency: currency.code,
      symbol: currency.symbol,
      items,
      totals,
      plan,
      warnings,
      snapshot,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Revalidation failed" }, { status: 500 });
  }
}