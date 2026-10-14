# VEYRO platform audit

Scope: security, payments & discounts, SEO, performance, data quality, resilience.
Status legend: ✅ fixed · ⏳ needs an action from the owner · 📌 recommendation

## Money & discounts
- ✅ **Client-set prices (critical).** Order totals used to come from the browser (and a local fallback if the revalidation call failed). Orders are now **re-priced server-side before any payment** (`checkoutRevalidate.verify_order`, called by `payments`): items, promotions, coupon, shipping, tax and instalment plan are recomputed from the catalogue and **overwrite** the client's numbers; `price_verified` can only be set by the server (RLS). Corrections are written to the audit log (`ORDER_PRICE_CORRECTED`).
- ✅ **Payments verified by the provider.** An order becomes `PAID` only after PayPal/Stripe/Paystack confirm it server-side (or NexaPay's signed webhook) with matching amount and currency.
- ✅ **Stock moves when the money does.** Inventory and promotion/coupon usage counters are updated once, when the payment is confirmed (not at cart time), so guests cannot drain stock.
- ✅ **Real discounts only.** Strike-through prices appear only for (a) a live promotion validated at checkout, or (b) our own previous price after a genuine drop in the last 30 days, between 3% and 50% (larger gaps are treated as data glitches and never advertised).
- ✅ Customers can no longer read supplier costs/margins (`price_snapshot`); the orders table is admin-only, customers read through the server.

## Checkout
- ✅ Guest checkout (no account); optional sign-in pre-fills the form. Orders are looked up with order number + e-mail.
- ✅ No order can be created without an available payment method (previously unpayable orders were shown as "confirmed").
- ✅ Payment methods shown as **Card** / **PayPal** with real brand marks; PayPal's official "Debit or Credit Card" button; all embedded, no redirect.

## Reviews & trust
- ✅ **Review import repaired.** It called a platform service from the previous host (`integrations.Core`) that no longer exists ("Cannot read properties of undefined (reading 'Core')"). It now reads CSV (any delimiter / quoting / BOM), JSON and XLSX itself, from a private admin-only bucket.
- ✅ **Integrity guard on imports.** A file is refused when many review texts are copies of each other, the same reviewer appears several times on one product, or reviews are attributed to VEYRO itself. Fake or templated reviews are illegal in the EU/UK/US and trigger Google review-spam actions.
- ✅ Ratings and `Review` markup in search results come only from published first-party reviews (verified buyers, moderated). Default 4.8 ratings are never displayed without real reviews.

## Crawler
- ✅ Tested live: 6/6 jobs succeeded (previously 1 of 3 failed). Listing/home/category pages are now recognised and expanded into product jobs instead of failing; stale locked jobs released; image checks use HEAD → ranged GET with referer and content-type validation.
- ⏳ The 5-minute schedule is created but **disabled**; enable it when you are ready for continuous crawling.

## Security
- ✅ RLS on every table; PSP keys encrypted (AES-GCM) in a server-only vault; never returned to the browser.
- ✅ Role changes impossible from the API (trigger) — fixed a bug that also blocked founder promotion.
- ✅ Supabase advisors: `auth.uid()` wrapped for per-query evaluation, mutable `search_path` fixed, helper functions no longer callable via RPC.
- ⏳ Enable **leaked-password protection** (Supabase → Authentication → Passwords).
- 📌 Drop the 17 legacy singular tables (`product`, `order`, …) once you've confirmed the migrated data (backup of the Base44 export).

## SEO
- ✅ Server-rendered HTML for home, categories, brands, products: unique title/description (≤158 chars with real price), canonical, hreflang, Open Graph, JSON-LD (Organization, WebSite+SearchAction, Product+Offer+MerchantReturnPolicy, BreadcrumbList, ItemList).
- ✅ Conflicting client-side canonical removed on server-rendered pages; faceted/search URLs are `noindex,follow` and canonicalise to the clean category.
- ✅ Policy pages (terms, privacy, returns, shipping, warranty, …) are server-rendered from the same content the app shows.
- ✅ Dynamic `/sitemap.xml` (images, lastmod, hreflang), `/robots.txt`, `/llms.txt`.
- ✅ Internal linking: related products, brand, category, policies.
- ✅ Duplicate product slug fixed; thin descriptions completed only from the product's own fields.
- ⏳ Attach a **custom domain**, verify it in Google Search Console and Bing Webmaster Tools, submit `/sitemap.xml`.
- 📌 Catalogue gaps hurting rich results: **GTIN missing on 404/404 products**, 394 without a meta description (auto-generated now), 3 without image (excluded from the sitemap), 11 images still hosted on Base44.

## Performance (Core Web Vitals)
- ✅ Entry bundle 1.54 MB → ~346 KB via route-level code splitting; admin code is only loaded for admins.
- ✅ Preconnect to Supabase, async image decoding, immutable cache headers for hashed assets.
- 📌 Serve product images from Supabase Storage / a CDN with responsive sizes and WebP/AVIF.

## Resilience
- ✅ Global error boundary; checkout never blocks on a failed price call (server re-prices at payment).
- ⏳ Crawler & reviews Edge Functions are written (`supabase/functions/{crawler,reviews}`) but need deploying (add the `SUPABASE_ACCESS_TOKEN` GitHub secret → workflow deploys them). The 5-minute crawler cron exists but is **disabled** until you've tested a source.
