// Server-side checkout revalidation: best eligible offer per product, authoritative
// pricing (central PricingConfig rules: margin, fees, shipping, tax, currency),
// installment plan and immutable price snapshot. The client NEVER decides prices.
// Before every order: last supplier check on price, stock and availability —
// stale supplier data triggers a priority live re-check job (never a block:
// VEYRO ships worldwide and its warehouse stock covers unavailable suppliers).
import { serve, createContext, waitUntil } from "../_shared/runtime.ts";
import {
  CURRENCIES, getCountry, convertPrice, round2, selectBestOffer,
} from "../_shared/commerce/pricing.js";
import {
  mergeConfig, resolveRules, computePriceChain, computePlanFromConfig,
} from "../_shared/commerce/rules.js";
import { selectFulfillmentSource } from "../_shared/commerce/stock.js";
import { bestAutoPromo, evaluateOrderPromos } from "../_shared/commerce/promotions.js";

const SUPPLIER_FRESH_MS = 24 * 60 * 60 * 1000; // supplier data older than 24h = stale

// Pure server-side quote: given a cart (product ids + quantities), a country, a plan and an
// optional coupon, returns authoritative prices. Nothing the browser sends is trusted but the cart.
async function quote(admin, { cartItems, countryCode, planId, couponCode }) {
  const now = new Date();
  if (!cartItems.length) return { error: "Cart empty", status: 400 };

    // Market control: a country the Super Admin has blocked (Market control)
    // can never be sold to — no price, no plan, no order.
    const marketCfg = await admin.entities.CountryConfig.filter({ code: countryCode }, null, 1).catch(() => []);
    if (marketCfg[0] && marketCfg[0].enabled === false) {
      return { ok: false, blocked_country: true, error: "VEYRO does not deliver to this country yet." };
    }

    const country = getCountry(countryCode);
    const currency = CURRENCIES[country.currency] || CURRENCIES.USD;

    // Central pricing rules — every order price derives from the Super Admin config.
    const cfgDocs = await admin.entities.PricingConfig.filter({ active: true }, "-created_date", 5);
    const config = mergeConfig(cfgDocs[0] || {});
    const installments = planId !== "pay_now";
    // Active promotions (automatic + coupons) — evaluated server-side only.
    const promos = await admin.entities.Promotion.filter({ active: true }, "-priority", 200).catch(() => []);
    const promoLines = [];
    const usedPromoIds = new Set();
    let autoSavingsUsd = 0;

    let subtotalUsd = 0;
    const warnings = [];
    const items = [];
    const snapshotItems = [];
    const supplierRecheckJobs = [];
    // Every cart line is priced, whatever happens: each product is fetched live
    // by its id (no listing cap, no status filter) and its unit price always
    // resolves — best offer → VEYRO price → engine price from the source price.
    const productMap = new Map();

    for (const line of cartItems) {
      const qty = Math.max(1, Math.min(Number(line.qty) || 1, 10));
      let product = productMap.get(line.product_id) || null;
      if (!product) {
        product = await admin.entities.Product.get(line.product_id).catch(() => null);
        if (product) productMap.set(line.product_id, product);
      }
      if (!product) continue; // only a deleted product can ever be dropped
      // VEYRO ships worldwide — no country restriction ever blocks a cart line.
      const offers = await admin.entities.Offer.filter({ product_id: product.id }).catch(() => []);
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
        : product.customer_price != null
          ? product.customer_price
          : product.source_price != null
            ? computePriceChain(product.source_price, rules, { installments }).customer_price
            : 0;
      const listedUsd = product.customer_price;
      // Live AUTOMATIC promotion — capped so the price never drops below the supplier cost.
      const auto = bestAutoPromo(promos, product, unitUsd, {
        now,
        floorUsd: best ? Number(best.source_price) || 0 : Number(product.source_price) || 0,
      });
      const finalUnitUsd = auto ? round2(unitUsd - auto.discount) : unitUsd;
      if (auto) {
        usedPromoIds.add(auto.promo.id);
        autoSavingsUsd = round2(autoSavingsUsd + auto.discount * qty);
      }
      // No line is ever blocked: VEYRO ships worldwide and its warehouse stock
      // (internal +10 sellable surplus per product) covers the order whenever
      // the partner supplier is out of stock.
      // FULFILLMENT_SOURCE: VEYRO's own physical stock ships first when enough
      // unreserved units exist — otherwise the verified partner supplier ships.
      const fulfillmentSource = selectFulfillmentSource(product, qty);
      const lineTotalUsd = round2(finalUnitUsd * qty);
      subtotalUsd = round2(subtotalUsd + lineTotalUsd);
      promoLines.push({ product, line_total_usd: lineTotalUsd });
      items.push({
        product_id: product.id,
        name: product.name,
        brand: product.brand,
        image_url: product.image_url,
        qty,
        unit_price: finalUnitUsd,
        list_unit_price: unitUsd,
        promo_label: auto ? auto.promo.label || auto.promo.name : null,
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
        unit_customer_price_usd: finalUnitUsd,
        list_unit_price_usd: unitUsd,
        promotion_id: auto ? auto.promo.id : null,
        unit_discount_usd: auto ? auto.discount : 0,
        fulfillment_source: fulfillmentSource,
        qty,
        line_total_usd: lineTotalUsd,
      });
    }

    // Order-level promotions: coupon code (validated here only) + free shipping.
    const promoEval = evaluateOrderPromos(promos, { lines: promoLines, subtotalUsd, couponCode, now });
    const discountUsd = promoEval.coupon_discount_usd;
    if (promoEval.coupon && promoEval.coupon.valid) usedPromoIds.add(promoEval.coupon.promotion_id);
    if (promoEval.free_shipping) usedPromoIds.add(promoEval.free_shipping.id);
    const netSubtotalUsd = round2(subtotalUsd - discountUsd);

    const countryRule = config.country_rules[countryCode] || {};
    // VEYRO worldwide shipping: flat $15 when no explicit country fee is
    // configured in the pricing rules — a seller without its own shipping
    // price never ships for free by accident (only a free-shipping promotion can).
    const shippingUsd = promoEval.free_shipping ? 0 : round2(
      typeof countryRule.shipping_fee === "number" ? countryRule.shipping_fee : 15
    );
    const taxRate = typeof countryRule.tax_rate === "number" ? countryRule.tax_rate : country.taxRate;
    const taxUsd = round2(netSubtotalUsd * taxRate);
    const totalUsd = round2(netSubtotalUsd + shippingUsd + taxUsd);
    const rate = currency.rate;

    const totals = {
      subtotal: convertPrice(subtotalUsd, currency.code),
      discount: convertPrice(discountUsd, currency.code),
      savings: convertPrice(round2(autoSavingsUsd + discountUsd), currency.code),
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
      discount_usd: discountUsd,
      auto_savings_usd: autoSavingsUsd,
      coupon: promoEval.coupon,
      free_shipping: !!promoEval.free_shipping,
      promotion_ids: [...usedPromoIds],
      totals_local: totals,
      plan,
      items: snapshotItems,
      note: "Immutable OrderPriceSnapshot — future source price or pricing-rule changes never modify this order.",
    };

    return {
      ok: true,
      currency: currency.code,
      symbol: currency.symbol,
      items,
      totals,
      plan,
      warnings,
      coupon: promoEval.coupon,
      free_shipping: !!promoEval.free_shipping,
      snapshot,
    };
}

// Re-price a stored order from the catalogue and OVERWRITE every monetary field with the server's
// numbers. A client can no longer pay less than the real price by editing the request it sends.
async function verifyOrder(admin, orderNumber) {
  const orders = await admin.entities.Order.filter({ order_number: orderNumber }, null, 1);
  const order = orders[0];
  if (!order) return { ok: false, error: "Order not found", status: 404 };
  if (order.status !== "PENDING_PAYMENT") return { ok: true, skipped: true };

  const cartItems = (Array.isArray(order.items) ? order.items : [])
    .map((i) => ({ product_id: i.product_id || i.id, qty: Math.max(1, Math.min(Number(i.qty) || 1, 10)) }))
    .filter((i) => i.product_id)
    .slice(0, 20);

  const cfgDocs = await admin.entities.PricingConfig.filter({ active: true }, "-created_date", 5);
  const config = mergeConfig(cfgDocs[0] || {});
  const count = Number(order.installment_count) || 0;
  const plan = config.installment_plans.find((p) => p.installments === count);
  const planId = count > 0 && plan ? plan.id : "pay_now";

  const q = await quote(admin, {
    cartItems,
    countryCode: String(order.country || "US").toUpperCase().slice(0, 2),
    planId,
    couponCode: order.coupon_code || "",
  });
  if (!q.ok) return { ok: false, error: q.error || "Order cannot be priced", status: q.status || 400 };
  const lines = q.items.filter((i) => i.available);
  if (!lines.length) return { ok: false, error: "No purchasable items", status: 400 };

  const claimed = Number(order.total) || 0;
  const drift = claimed > 0 ? Math.abs(q.totals.total - claimed) / claimed : 1;
  if (drift > 0.005) {
    await admin.entities.AuditLog.create({
      actor_email: order.customer_email || "",
      action: "ORDER_PRICE_CORRECTED",
      target_type: "order",
      target_id: orderNumber,
      details: `Client total ${claimed} replaced by server total ${q.totals.total} ${q.currency}`,
    }).catch(() => {});
  }

  await admin.entities.Order.update(order.id, {
    items: lines.map((i) => ({
      id: i.product_id, name: i.name, brand: i.brand, price: i.unit_price, qty: i.qty,
      seller_id: i.seller_id, seller_name: i.seller_name, delivery_days: i.delivery_days,
      fulfillment_source: i.fulfillment_source || "SUPPLIER",
    })),
    subtotal: q.totals.subtotal,
    discount: q.totals.discount || 0,
    coupon_code: q.coupon && q.coupon.valid ? q.coupon.code : "",
    shipping: q.totals.shipping,
    tax: q.totals.tax,
    total: q.totals.total,
    currency: q.currency,
    down_payment: q.plan.downPayment || q.totals.total,
    installment_count: q.plan.installmentCount || 0,
    installment_amount: q.plan.installmentAmount || 0,
    price_snapshot: q.snapshot,
    price_verified: true,
  });
  return { ok: true, total: q.totals.total, currency: q.currency, corrected: drift > 0.005 };
}

serve(async (req) => {
  try {
    const { admin } = await createContext(req);
    const body = await req.json().catch(() => ({}));

    if (typeof body.verify_order === "string") {
      const r = await verifyOrder(admin, body.verify_order.slice(0, 40));
      return Response.json(r, { status: r.ok ? 200 : r.status || 400 });
    }

    const out = await quote(admin, {
      cartItems: Array.isArray(body.items) ? body.items.slice(0, 20) : [],
      countryCode: String(body.country_code || "US").toUpperCase().slice(0, 2),
      planId: String(body.plan_id || "plan_5"),
      couponCode: typeof body.coupon_code === "string" ? body.coupon_code.slice(0, 32) : "",
    });
    return Response.json(out, { status: out.error && !out.blocked_country ? out.status || 400 : 200 });
  } catch (error) {
    return Response.json({ error: error.message || "Revalidation failed" }, { status: 500 });
  }
});
