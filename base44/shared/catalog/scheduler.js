// AUTOMATIC crawler orchestration — runs on a cron schedule (every 5 min) so
// the catalog refreshes itself after deployment, with no manual action.
// Per-source frequency: CrawlerSource.crawl_interval_minutes (next_run gate).
// Per-product frequency: refresh tiers (POPULAR 15min / IMPORTANT 2h /
// NORMAL 8h / LOW 48h), auto-derived from demand signals or set explicitly on
// the product. Refreshes update price, stock, availability, delivery & images.

import { runDiscovery } from "./discover.js";
import { processQueueBatch } from "./worker.js";

// Shared secret between this module and the cron automation's function_args —
// required when the endpoint is hit without a signed-in admin user.
export const AUTOMATION_KEY = "veyro-orchestrate-9f4c2a71-8e3b-4d16-b5a0-2c7e91d84f03";

export const TIER_INTERVALS_MIN = {
  POPULAR: 15, // 5–15 min band
  IMPORTANT: 120, // 30–120 min band
  NORMAL: 480, // 6–12 h band
  LOW: 2880, // 24–48 h band
};

const TIER_PRIORITY = { POPULAR: 3, IMPORTANT: 5, NORMAL: 7, LOW: 9 };
const MAX_SOURCES_PER_RUN = 3;
const MAX_REFRESH_JOBS_PER_RUN = 25;

// Demand-driven tier: explicit product override wins, otherwise signals decide.
export function tierForProduct(product, wishlistCounts, orderCounts) {
  if (product.refresh_tier && product.refresh_tier !== "AUTO") return product.refresh_tier;
  const wl = wishlistCounts[product.id] || 0;
  const orders = orderCounts[product.id] || 0;
  const ageMs = product.last_crawled_at ? Date.now() - new Date(product.last_crawled_at).getTime() : Infinity;
  if (orders >= 1 || wl >= 3 || (product.premium_status === "PREMIUM" && (product.rating || 0) >= 4.8)) return "POPULAR";
  if (wl >= 1 || product.premium_status === "PREMIUM") return "IMPORTANT";
  if (product.stock_status === "OUT_OF_STOCK" || ageMs > 30 * 24 * 60 * 60 * 1000) return "LOW";
  return "NORMAL";
}

function countByProduct(items, extract) {
  const counts = {};
  for (const item of items) {
    for (const pid of extract(item)) {
      counts[pid] = (counts[pid] || 0) + 1;
    }
  }
  return counts;
}

export async function orchestrate({ admin, maxJobs = 25 }) {
  const now = new Date();
  const summary = { sources_run: 0, discovery_errors: 0, refresh_enqueued: 0, queue: null };

  // 1) Sources due for a full crawl (per-source crawl_interval_minutes)
  const sources = await admin.entities.CrawlerSource.list(null, 200);
  const due = sources
    .filter((s) => s.enabled && s.status !== "DISABLED" && (!s.next_run || new Date(s.next_run) <= now))
    .sort((a, b) => (a.priority || 5) - (b.priority || 5))
    .slice(0, MAX_SOURCES_PER_RUN);
  for (const source of due) {
    try {
      await runDiscovery({ admin, source, actor: null });
      summary.sources_run++;
    } catch (error) {
      summary.discovery_errors++;
      await admin.entities.CrawlerSource.update(source.id, {
        status: source.status === "ERROR" ? "ERROR" : "WARNING",
        last_error: String((error && error.message) || error).slice(0, 300),
      }).catch(() => {});
    }
  }

  // 2) Products due for a price/stock/availability/image refresh (per-product tier)
  const products = await admin.entities.Product.list("-premium_score", 2000);
  const wishlist = await admin.entities.WishlistItem.list(null, 500);
  const orders = await admin.entities.Order.list("-created_date", 200);
  const wishlistCounts = countByProduct(wishlist, (w) => (w.product_id ? [w.product_id] : []));
  const orderCounts = countByProduct(orders, (o) =>
    (Array.isArray(o.items) ? o.items : []).map((it) => it.product_id).filter(Boolean)
  );

  const [queuedJobs, retryingJobs] = await Promise.all([
    admin.entities.CrawlerJob.filter({ status: "QUEUED" }, null, 500),
    admin.entities.CrawlerJob.filter({ status: "RETRYING" }, null, 200),
  ]);
  const alreadyScheduled = new Set(
    [...queuedJobs, ...retryingJobs].filter((j) => j.product_id).map((j) => j.product_id)
  );

  const refreshJobs = [];
  for (const product of products) {
    if (refreshJobs.length >= MAX_REFRESH_JOBS_PER_RUN) break;
    if (product.status !== "PUBLISHED" || !product.source_url) continue;
    if (alreadyScheduled.has(product.id)) continue;
    const tier = tierForProduct(product, wishlistCounts, orderCounts);
    const intervalMs = (TIER_INTERVALS_MIN[tier] || TIER_INTERVALS_MIN.NORMAL) * 60000;
    const last = product.last_crawled_at ? new Date(product.last_crawled_at).getTime() : 0;
    if (now.getTime() - last >= intervalMs) {
      refreshJobs.push({
        type: "UPDATE_PRICE",
        source_id: product.source_id,
        product_id: product.id,
        url: product.source_url,
        priority: TIER_PRIORITY[tier] || 7,
        status: "QUEUED",
        scheduled_at: now.toISOString(),
      });
    }
  }
  if (refreshJobs.length) {
    await admin.entities.CrawlerJob.bulkCreate(refreshJobs);
    summary.refresh_enqueued = refreshJobs.length;
  }

  // 3) Process a paced batch of the queue (rate-limited against merchant APIs)
  summary.queue = await processQueueBatch({ admin, actor: null, maxJobs });

  return summary;
}