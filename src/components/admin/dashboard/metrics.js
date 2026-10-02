// Pure derivations for the admin real-time dashboard — no React, no I/O.
// Every figure is computed from real records; nothing is invented.

export const PAID_STATUSES = [
  "PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "COMPLETED",
];
export const ACTIVE_STATUSES = ["VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED", "IN_TRANSIT"];
export const ORDER_STATUSES = [
  "PENDING_PAYMENT", "PAID", "VERIFYING_SUPPLIER", "PROCESSING", "SHIPPED",
  "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED", "PAYMENT_FAILED", "SUPPLIER_FAILURE",
];

const DAY = 86400000;

export function rateOf(rates, code) {
  const row = (rates || []).find((r) => r.code === code);
  return row && row.rate > 0 ? row.rate : 1;
}

// CurrencyRate.rate = units of that currency per 1 USD (store base is USD).
export function toUsd(amount, code, rates) {
  return (Number(amount) || 0) / rateOf(rates, code || "USD");
}

export function dayKey(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function buildMetrics(data) {
  const {
    orders = [], products = [], sources = [], jobs = [], events = [], rates = [], providers = [],
  } = data || {};
  const since = Date.now() - 30 * DAY;

  const paid = orders.filter((o) => PAID_STATUSES.includes(o.status));
  const paid30 = paid.filter((o) => new Date(o.created_date).getTime() >= since);
  const orders30 = orders.filter((o) => new Date(o.created_date).getTime() >= since);
  const revenue30 = paid30.reduce((s, o) => s + toUsd(o.total, o.currency, rates), 0);
  const revenueAll = paid.reduce((s, o) => s + toUsd(o.total, o.currency, rates), 0);

  const statusCounts = ORDER_STATUSES.reduce((m, s) => ({ ...m, [s]: 0 }), {});
  for (const o of orders) if (statusCounts[o.status] !== undefined) statusCounts[o.status] += 1;

  const catalog = products.reduce(
    (a, p) => {
      a.total += 1;
      if (p.status === "PUBLISHED") a.published += 1;
      else if (p.status === "REVIEW") a.review += 1;
      else if (p.status === "REJECTED") a.rejected += 1;
      if (p.image_status === "IMAGE_INCOMPLETE") a.imageIncomplete += 1;
      return a;
    },
    { total: 0, published: 0, review: 0, rejected: 0, imageIncomplete: 0 }
  );

  const crawl = sources.reduce(
    (a, s) => {
      a.urls += s.urls_discovered || 0;
      a.found += s.products_found || 0;
      a.validated += s.products_validated || 0;
      a.rejected += s.products_rejected || 0;
      a.updated += s.products_updated || 0;
      a.failed += s.products_failed || 0;
      a.imagesOk += s.images_found || 0;
      a.imagesKo += s.images_failed || 0;
      return a;
    },
    { urls: 0, found: 0, validated: 0, rejected: 0, updated: 0, failed: 0, imagesOk: 0, imagesKo: 0 }
  );

  const jobCounts = jobs.reduce((m, j) => ({ ...m, [j.status]: (m[j.status] || 0) + 1 }), {});
  const jobsPending = (jobCounts.QUEUED || 0) + (jobCounts.RUNNING || 0) + (jobCounts.RETRYING || 0);

  const sourceHealth = sources.reduce((m, s) => {
    const key = s.status || "ACTIVE";
    return { ...m, [key]: (m[key] || 0) + 1 };
  }, {});

  const webhooks = events.reduce(
    (a, e) => {
      a.total += 1;
      if (e.status === "PROCESSED") a.processed += 1;
      if (e.status === "DUPLICATE") a.duplicates += 1;
      if (e.status === "INVALID_SIGNATURE") a.invalid += 1;
      if (e.status === "TRANSACTION_MISMATCH") a.mismatch += 1;
      if (e.status === "ERROR" || e.status === "INVALID_PAYLOAD") a.errors += 1;
      return a;
    },
    { total: 0, processed: 0, duplicates: 0, invalid: 0, mismatch: 0, errors: 0 }
  );

  const enabledProviders = providers.filter((p) => p.enabled);

  return {
    revenue30, revenueAll,
    orders30: orders30.length,
    aov: paid30.length ? revenue30 / paid30.length : 0,
    paidCount: paid.length,
    activeOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    installmentCount: paid.filter((o) => (o.installment_count || 0) > 0).length,
    statusCounts,
    catalog, crawl, jobCounts, jobsPending, sourceHealth, webhooks,
    providers: {
      enabled: enabledProviders.length,
      live: enabledProviders.filter((p) => p.mode === "LIVE").length,
      test: enabledProviders.filter((p) => p.mode !== "LIVE").length,
      configured: providers.filter((p) => p.configured).length,
      list: enabledProviders,
    },
  };
}

export function salesSeries(orders, rates, days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
      revenue: 0,
      orders: 0,
    });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const o of orders || []) {
    const i = idx.get(dayKey(o.created_date));
    if (i === undefined) continue;
    buckets[i].orders += 1;
    if (PAID_STATUSES.includes(o.status)) buckets[i].revenue += toUsd(o.total, o.currency, rates);
  }
  return buckets.map((b) => ({ ...b, revenue: Math.round(b.revenue) }));
}

// Crawler intake: products the pipeline discovered, per day.
export function crawlSeries(products, days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
      count: 0,
    });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const p of products || []) {
    const i = idx.get(dayKey(p.first_seen_at || p.created_date));
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets;
}

export function topProducts(orders, rates, limit = 6) {
  const map = new Map();
  for (const o of orders || []) {
    if (!PAID_STATUSES.includes(o.status)) continue;
    for (const it of o.items || []) {
      const key = it.id || it.product_id || it.name;
      const row = map.get(key) || { name: it.name || "—", brand: it.brand || "", qty: 0, revenue: 0 };
      row.qty += it.qty || 0;
      row.revenue += toUsd((it.price || 0) * (it.qty || 0), o.currency, rates);
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

export const timeAgo = (value) => {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  if (isNaN(diff)) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};