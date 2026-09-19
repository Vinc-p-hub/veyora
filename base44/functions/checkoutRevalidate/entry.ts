// Server-side checkout revalidation: best eligible offer per product, authoritative
// pricing (margin, shipping, tax, currency), installment plan and immutable price snapshot.
// The client NEVER decides prices — this function does.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  CURRENCIES, getCountry, convertPrice, round2,
  computeCustomerPrice, getPlanForOption, selectBestOffer,
} from "../../shared/commerce/pricing.js";

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

    if (!cartItems.length) return Response.json({ error: "Cart empty" }, { status: 400 });

    const products = await admin.entities.Product.list(null, 500);
    const allOffers = await admin.entities.Offer.list(null, 500);
    const country = getCountry(countryCode);
    const currency = CURRENCIES[country.currency] || CURRENCIES.USD;

    let subtotalUsd = 0;
    const warnings = [];
    const items = [];
    const snapshotItems = [];

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
      const unitUsd = best ? computeCustomerPrice(best.source_price) : product.customer_price;
      const listedUsd = product.customer_price;
      if (Math.abs(unitUsd - listedUsd) > 0.01) {
        warnings.push(`The price of ${product.name} changed since you added it — updated below.`);
      }
      if (product.stock_status === "OUT_OF_STOCK") {
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
        changed: Math.abs(unitUsd - listedUsd) > 0.01,
        available: true,
      });
      snapshotItems.push({
        product_id: product.id,
        name: product.name,
        offer_id: best ? best.id : null,
        source_id: best ? best.source_id : (product.source_id || null),
        source_price: best ? best.source_price : product.source_price,
        unit_customer_price_usd: unitUsd,
        qty,
        line_total_usd: lineTotalUsd,
      });
    }

    const shippingUsd = country.shipping;
    const taxUsd = round2(subtotalUsd * country.taxRate);
    const totalUsd = round2(subtotalUsd + shippingUsd + taxUsd);
    const rate = currency.rate;

    const totals = {
      subtotal: convertPrice(subtotalUsd, currency.code),
      shipping: convertPrice(shippingUsd, currency.code),
      tax: convertPrice(taxUsd, currency.code),
      total: convertPrice(totalUsd, currency.code),
    };
    const plan = getPlanForOption(totals.total, planId);

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
      note: "Immutable OrderPriceSnapshot — future source price changes never modify this order.",
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