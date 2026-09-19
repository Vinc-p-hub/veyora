# VEYRO — Premium Electronics Marketplace

An international premium electronics marketplace with a **real backend catalog pipeline**:
source adapters → discovery → job queue → fetch worker → parser → validator → matcher →
premium engine → pricing engine → catalog → search index → storefront.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS (noon.com-inspired design system, Poppins)
- **Backend**: Base44 platform services — entities (RLS-secured), server-side functions (Deno runtime), service-role operations
- **Data layer**: Base44 entities (schema-first, provider-agnostic — see `docs/ARCHITECTURE.md` for the Neon/PostgreSQL migration path)

## Core systems

| System | Where | What it does |
|---|---|---|
| Crawler | `base44/functions/crawlerRunSource`, `crawlerProcessQueue` | Real HTTP ingestion: JSON merchant feeds, sitemaps + JSON-LD product pages, URL lists. Queue with job locking, crash recovery, exponential-backoff retry (1/5/15 min), source health monitoring (>30% fail = WARNING, >60% = ERROR pauses auto-publish) |
| Catalog pipeline | `base44/shared/catalog/*` | URL canonicalization, normalization, validation (missing optional fields never reject a product — they lower the quality score), dedup/matching (GTIN/MPN/SKAN/slug/title, AUTO ≥0.9, manual review 0.6–0.9), premium scoring |
| Offers | `Offer` entity + `selectBestOffer()` | PRODUCT vs OFFER separation; multi-source products; best eligible offer by price + shipping + supplier reliability + delivery + country eligibility |
| Pricing | `base44/shared/commerce/pricing.js` | Server-side margin, shipping, tax, currency conversion (USD/EUR/AED/GBP/NGN/XOF/XAF/CAD/AUD), installment plans with the **total always visible** |
| Search | `searchProducts` function + `base44/shared/search/engine.js` | Search-as-you-type, synonyms ("i phone"→"iphone"), typo tolerance (Levenshtein), ranking by relevance + premium + availability, zero-result fallback ("Maybe you meant…"), query analytics |
| Checkout | `checkoutRevalidate` function | Server re-validation before payment: best offer, live price, availability, tax, plan; returns an immutable `OrderPriceSnapshot` — future source price changes never touch completed orders |
| Admin | `/admin` | Role-gated operations console: overview, crawler control (run/pause/retry/ignore), review queue, product catalog, search analytics, audit log |
| Security | RLS on all entities + `ensureStaffRoles` | Server-side role assignment only; a client-side email match is never sufficient. Crawler/admin functions verify `user.role === 'admin'` on every invocation |

## Local development

```bash
npm install
npm run dev        # frontend against the Base44 hosted backend
npm run build      # production build
node --test tests/ # pipeline unit tests (normalizer, validator, matcher, premium, search, pricing)
```

Note: writes against the hosted backend affect production data.

## Repository hygiene (GitHub sync)

- Project structure is kept compatible with the Base44 CLI / GitHub sync workflow.
- `docs/ARCHITECTURE.md` documents the full pipeline and the Neon / Cloudflare migration path.
- `.env.example` lists external provider credentials **for a future self-hosted deployment only** — production secrets live in the Base44 dashboard (Settings → Secrets), never in git.

## Scheduled crawling

The queue worker (`crawlerProcessQueue`) is idempotent and lock-protected — it can be run on a
schedule (Base44 scheduled task / external cron hitting the function endpoint) or manually from
Admin → Crawlers → "Process queue now".