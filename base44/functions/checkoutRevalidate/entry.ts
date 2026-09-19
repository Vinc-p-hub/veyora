// Server-side checkout revalidation: best eligible offer per product, authoritative
// pricing (central PricingConfig rules: margin, fees, shipping, tax, currency),
// installment plan and immutable price snapshot. The client NEVER decides prices.
// Before every order: last supplier check on price, stock and availability —
// stale or missing supplier data triggers a priority live re-check job.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import {
  CURRENCIES, getCountry, convertPrice, round2, selectBestOffer,
} from "../../shared/commerce/pricing.js";
import {
  mergeConfig, resolveRules, computePriceChain, computePlanFromConfig,
} from "../../shared/commerce/rules.js";

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
      if (!product) {
        warnings.push(`A product in your cart is no longer available and was removed from the calculation.`);
        continue;
      }
      if (product.available_countries && product.available_countries.length &&
          !product.available_countries.includes(countryCode)) {
        warnings.push(`${product.name} is not available for delivery to ${countryCode}.`);
        items.push({ product_id: product.id, name: product.name, brand: product.brand, image_url: product.image_url, qty, available: false });
        continue;
      }
      const offers = allOffers.filter((o) => o.product_id === product.id);
      const best = offers.length ? selectBestOffer(offers, countryCode) : null;

      // --- last supplier verification before the order ---
      let supplierFresh = true;
      if (!best) {
        supplierFresh = false;
        warnings.push(`${product.name}: supplier availability will be re-verified live before your order is confirmed.`);
      } else if (best.stale || !best.last_checked || now - new Date(best.last_checked) > SUPPLIER_FRESH_MS) {
        supplierFresh = false;
        warnings.push(`${product.name}: supplier data is over 24h old — a live price and stock re-check has been triggered.`);
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
      if (Math.abs(unitUsd - listedUsd) > 0.01) {
        warnings.push(`The price of ${product.name} changed since you added it — updated below.`);
      }
      if (best && best.stock_status === "OUT_OF_STOCK") {
        warnings.push(`${product.name} is currently out of stock at the supplier.`);
      } else if (product.stock_status === "OUT_OF_STOCK") {
        warnings.push(`${product.name} is currently out of stock.`);
      }
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
        qty,
        line_total_usd: lineTotalUsd,
      });
    }

    const countryRule = config.country_rules[countryCode] || {};
    const shippingUsd = round2(
      typeof countryRule.shipping_fee === "number" ? countryRule.shipping_fee : country.shipping
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