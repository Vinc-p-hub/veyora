# Edge Functions

Deployed automatically on every push that touches this folder (`.github/workflows/deploy-functions.yml`,
needs the `SUPABASE_ACCESS_TOKEN` repository secret).

| Function | Purpose |
|---|---|
| `payments` | Payment vault (admin), embedded checkouts, webhooks, guest order lookup |
| `checkoutRevalidate` | Authoritative pricing + `verify_order` (server re-prices every order) |
| `pricingEngine`, `searchProducts` | Pricing rules, catalogue search |
| `crawler` | Source discovery, queue worker, orchestrator, normalisation, image fill |
| `reviews`, `staff` | Reviews pipeline; staff roles and invitations |

Shared code lives in `_shared/` (catalog pipeline, pricing rules, search engine, runtime helpers).
# 2026-10-13T11:40:58Z
