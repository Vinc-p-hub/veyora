# VEYRO

Premium electronics marketplace — transparent pricing, verified sellers, installments with the total always visible.

## Stack
- **Frontend:** React + Vite (`src/`), deployed on Cloudflare Pages.
- **Backend:** Supabase — Postgres + RLS, Auth, Realtime, Storage, Edge Functions (`supabase/`).
- **SEO:** Cloudflare Pages Functions (`functions/`) render product/brand pages for crawlers (meta, hreflang, JSON-LD) and serve `/sitemap.xml` + `/robots.txt`.
- **Payments:** PayPal Checkout (embedded) via the `paypal` Edge Function; amounts always come from the database.

## Layout
| Path | Purpose |
|---|---|
| `src/api/client.js` | Data layer (entities, functions, storage) on Supabase |
| `supabase/migrations/` | Schema + RLS |
| `supabase/functions/paypal` | PayPal create/capture with server-side verification |
| `supabase/functions/crawler` | Source discovery, queue worker, orchestrator, normalization, image fill |
| `supabase/functions/{pricingEngine,searchProducts,checkoutRevalidate,reviews,staff}` | Pricing, search, checkout gate, reviews, staff roles |
| `supabase/functions/_shared` | Catalog pipeline (normalize/validate/match/premium), pricing rules, search engine |
| `functions/` | Cloudflare Pages Functions (SEO) |

## Setup
1. `cp .env.example .env` (Supabase URL + anon key are public values).
2. Supabase → Edge Functions → Secrets: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`.
3. GitHub → Actions secret `SUPABASE_ACCESS_TOKEN` to auto-deploy functions on push (`.github/workflows/deploy-functions.yml`).
4. `npm install && npm run dev` · tests: `npm test`.

## Crawler
Real HTTP ingestion: JSON merchant feeds, sitemaps + JSON-LD product pages, URL lists. Job queue with locking and exponential-backoff retry; source health monitoring; canonicalization, validation, dedup/matching (GTIN/MPN/SKU/slug/title) and premium scoring in `supabase/functions/_shared/catalog`.
