# VEYRO Architecture

## Catalog ingestion pipeline

```
SOURCE (CrawlerSource: FEED_JSON | SITEMAP_JSONLD | URL_LIST_JSONLD)
   ↓  crawlerRunSource        — adapter-configured discovery, bounded by max_products_per_run
DISCOVERY → CrawlerJob queue   (FETCH_PRODUCT / UPDATE_PRICE / …)
   ↓  crawlerProcessQueue     — job locking (locked_at/locked_by), stale-lock recovery (10 min)
FETCH WORKER                  — real HTTP fetch, robots.txt respected, 15s timeout
   ↓
PARSER (JSON feed mapping / schema.org JSON-LD)      ← per-source field_map, no source logic in core
   ↓
NORMALIZER      base44/shared/catalog/normalize.js  — URL canonicalization (tracking params stripped),
                                                      price/currency/stock/brand/category normalization
   ↓
VALIDATOR       base44/shared/catalog/validate.js   — required: title, brand, price, currency, url.
                                                      Missing OPTIONAL fields → lower data_quality_score,
                                                      status REVIEW — never silent rejection/deletion.
   ↓
MATCHER         base44/shared/catalog/match.js       — GTIN / MPN+brand / SKU+brand / canonical_url /
                                                      slug / title similarity → AUTO_MATCH ≥ 0.9,
                                                      MANUAL_REVIEW 0.6–0.9, NEW below.
   ↓
PREMIUM ENGINE  base44/shared/catalog/premium.js    — brand tier + price + quality + rating →
                                                      premium_score, premium_status (PREMIUM/APPROVED/REVIEW/REJECTED)
   ↓
PRICING ENGINE  base44/shared/commerce/pricing.js   — margin + currency; Offer upsert (PRODUCT vs OFFER)
   ↓
CATALOG (Product entity, RLS: public read / admin write)  +  SEARCH (server-side engine)
```

## Fault tolerance rules

- One failing product → only that job retries (backoff 1/5/15 min) then enters the admin error queue.
- One failing source → source flagged WARNING/ERROR, auto-publish paused, other sources unaffected.
- One failing parser → other adapters unaffected (parsing is per-source configuration).
- Unknown stock is never a reason to drop a good product — it publishes with `stock_status: UNKNOWN`
  when premium + validation pass.

## Source health monitoring

Per run: fail rate > 30% → `WARNING`, > 60% → `ERROR` (auto-publish for that source paused).
Success stats (`products_discovered/updated/failed`, `last_run`, `next_run`, `last_error`)
are visible in Admin → Crawlers, with Run now / Pause / Resume / Retry / Ignore actions.

## Search

- Query normalization: synonyms ("i phone"→"iphone", "mac book"→"macbook", "playstation 5"→"ps5", …).
- Typo tolerance: per-token Levenshtein expansion against a lexicon built from the live catalog.
- Ranking: token relevance × coverage + premium score + rating + stock + premium status —
  never insertion order alone.
- International: results filtered by `available_countries` for the delivery country.
- Zero results: corrected query suggestion ("Did you mean…") + related/premium fallback products.
- Every query is logged (`SearchQuery`) for admin analytics: top searches, zero-result rate.

## Checkout (server-authoritative)

`checkoutRevalidate` recomputes everything server-side before payment:
best eligible offer per product → live customer price → shipping → tax → currency → plan.
It returns warnings (price changed, unavailable in country) and an immutable `price_snapshot`
stored on the order. The client only displays; it never decides prices.

## Security

- RLS on every entity: public reads only where intended (Product, Offer, own Orders);
  catalog writes and all crawler/admin entities are admin-only (service-role backend calls bypass RLS).
- Admin functions verify `base44.auth.me().role === "admin"` on every invocation (403 otherwise).
- Staff roles (`staff_role`: SUPER_ADMIN, ADMIN, CATALOG_MANAGER, CRAWLER_MANAGER, FINANCE,
  OPERATIONS, SUPPORT) are assigned server-side by `ensureStaffRoles`; the bootstrap SUPER_ADMIN
  accounts are verified against the authenticated user's email on the server, never client-side.
- Every role assignment, crawler run and admin operation is audit-logged (`AuditLog`).
- Crawling respects robots.txt, rate limits (requests_per_minute) and configured URL patterns;
  it never bypasses CAPTCHAs, logins or anti-bot systems. Only authorized sources are crawled.

## Data layer portability (Neon / PostgreSQL)

All persistence goes through Base44 entities with plain JSON schemas (see `base44/entities/*.jsonc`)
— no provider-specific queries in business logic. A PostgreSQL/Neon migration maps 1:1:

```
Product → products (jsonb specifications, text[] available_countries, index on slug/canonical_url/gtin)
Offer   → offers  (index on product_id, source_id, countries)
CrawlerJob → crawler_jobs (index on status, priority, scheduled_at, locked_at)
Order  → orders  (index on customer_email, status, created_at) + price_snapshots jsonb
SearchQuery → search_queries (index on query, country)
AuditLog → audit_logs (index on created_at)
```

## Deployment (Cloudflare-ready)

The frontend is static and CDN-cacheable. Crawler workers run as Base44 functions (short-lived,
queue-based, idempotent) — compatible with a future move to Cloudflare Workers + Queues/R2 by
swapping the `base44.entities.*` calls for a thin data-access layer implementing the same methods.
No long-running in-process crawling: state lives in the job queue, so any worker can crash and resume.

## Deferred roadmap

- Real PSP adapters (Stripe/Paystack/PayUnit/crypto) behind the provider abstraction — requires
  live API credentials via the Base44 secrets dashboard.
- Scheduled crawler runs via Base44 scheduled tasks.
- Search click-through tracking and admin synonym editor.
- Variant model (storage/color), notifications, and monitoring dashboards.