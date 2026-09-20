// Pipeline tests — run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeUrl, slugify, normalizeStock, normalizeCurrency, normalizePrice, inferCategory,
} from "../base44/shared/catalog/normalize.js";
import { validateProduct } from "../base44/shared/catalog/validate.js";
import { matchProduct } from "../base44/shared/catalog/match.js";
import { enrichFeedRaw, parseProductPage, absolutizeImageUrl, stripHtml, extractJsonLd } from "../base44/shared/catalog/extract.js";
import { premiumScore } from "../base44/shared/catalog/premium.js";
import { searchCatalog, normalizeQuery, levenshtein } from "../base44/shared/search/engine.js";
import {
  computeCustomerPrice, buildInstallmentPlan, getPlanForOption, selectBestOffer, convertPrice,
} from "../base44/shared/commerce/pricing.js";

const goodProduct = {
  title: "Sony WH-1000XM6",
  brand: "Sony",
  price: 350,
  currency: "USD",
  url: "https://example.com/p/sony-wh-1000xm6?utm_source=x",
  image: "https://example.com/img.jpg",
  category: "Audio",
  stock_status: "IN_STOCK",
};

test("normalizer: canonicalizeUrl strips tracking params and detects duplicates", () => {
  const a = canonicalizeUrl("https://Example.com/p/x?utm_source=nl&gclid=123");
  const b = canonicalizeUrl("https://example.com/p/x");
  assert.equal(a, b);
  assert.equal(canonicalizeUrl("https://example.com/p/x/"), canonicalizeUrl("https://example.com/p/x"));
});

test("normalizer: price / currency / stock / category", () => {
  assert.equal(normalizePrice("$1,299.00"), 1299);
  assert.equal(normalizePrice("abc"), null);
  assert.equal(normalizeCurrency("usd"), "USD");
  assert.equal(normalizeStock("https://schema.org/InStock"), "IN_STOCK");
  assert.equal(normalizeStock(""), "UNKNOWN");
  assert.equal(inferCategory("MacBook Pro 16"), "Laptops");
  assert.equal(inferCategory("iPhone 17 Pro"), "Smartphones");
  assert.equal(inferCategory("ASUS RT-AX88U Pro Router"), "Networking");
  assert.equal(inferCategory("Sony WH-1000XM6 Wireless Headphones"), "Headphones & Earbuds");
});

test("validator: missing stock never rejects a good product", () => {
  const noStock = { ...goodProduct, stock_status: "UNKNOWN", stock: null };
  const v = validateProduct(noStock);
  assert.equal(v.status, "APPROVED");
  assert.ok(v.qualityScore > 0.6);

  const noPrice = validateProduct({ ...goodProduct, price: null });
  assert.equal(noPrice.status, "REVIEW");
  assert.ok(noPrice.missing.includes("price"));

  // brand/category/image/stock are optional — never block publication
  const minimal = { title: "Widget", price: 10, currency: "USD", url: "https://x.com/p/1" };
  const vmin = validateProduct(minimal);
  assert.equal(vmin.status, "APPROVED");
  assert.equal(vmin.missing.length, 0);
});

test("extract: Shopify-style feed enrichment + image absolutizing", () => {
  const raw = enrichFeedRaw({
    title: "Test Keyboard",
    vendor: "Acme",
    body_html: "<p>Great <b>keyboard</b> for pros.</p>",
    price: "99.00",
    variants: [
      { title: "Black", price: "99.00", available: false, compare_at_price: "129.00" },
      { title: "White", price: "109.00", available: true, sku: "T-W" },
    ],
    images: [{ src: "https://cdn.example.com/a.jpg" }, { src: "https://cdn.example.com/b.jpg" }],
  });
  assert.equal(raw.price, "109.00"); // best AVAILABLE variant wins
  assert.equal(raw.stock, "true");
  assert.equal(raw.image, "https://cdn.example.com/a.jpg");
  assert.equal(raw.gallery[0], "https://cdn.example.com/a.jpg");
  assert.ok(!raw.description.includes("<"));
  assert.ok(raw.description.includes("keyboard"));
  assert.equal(raw.compare_at_price, 129);
  assert.equal(absolutizeImageUrl("/img/x.png", "https://shop.example.com"), "https://shop.example.com/img/x.png");
  assert.equal(absolutizeImageUrl("data:image/png;base64,xx", "https://x.com"), null);
  assert.equal(stripHtml("<p>Hello <b>world</b>!</p>"), "Hello world!");
});

test("extract: parseProductPage reads JSON-LD, og:image and relative images", () => {
  const html = `<html><head>
    <meta property="og:image" content="/static/og-hero.jpg">
    <meta property="og:title" content="Test Headphones">
    </head><body>
    <img src="/img/one.jpg">
    <img data-src="https://cdn.example.com/two.webp">
    <img class="logo" src="/img/logo.png">
    <script type="application/ld+json">{"@type":"Product","name":"LD Name","offers":{"price":"50","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script>
    </body></html>`;
  const { raw, imageCandidates } = parseProductPage(html, "https://shop.example.com/product/1");
  assert.equal(raw.title, "LD Name");
  assert.equal(raw.price, 50);
  assert.equal(raw.currency, "USD");
  assert.equal(raw.stock_status ?? raw.stock, "https://schema.org/InStock");
  assert.ok(imageCandidates.includes("https://shop.example.com/static/og-hero.jpg"));
  assert.ok(imageCandidates.includes("https://cdn.example.com/two.webp"));
  assert.ok(!imageCandidates.some((u) => u.includes("logo")));
});

test("matcher: GTIN auto-matches, unrelated products stay separate", () => {
  const candidates = [
    { id: "1", name: "Sony WH-1000XM6", brand: "Sony", gtin: "1234567890123", slug: "sony-wh-1000xm6" },
    { id: "2", name: "Bose QC Ultra", brand: "Bose", slug: "bose-qc-ultra" },
  ];
  const m = matchProduct({ ...goodProduct, gtin: "1234567890123", slug: "sony-wh-1000xm6" }, candidates);
  assert.equal(m.decision, "AUTO_MATCH");
  assert.equal(m.product.id, "1");

  const unrelated = matchProduct({ ...goodProduct, title: "Totally Different Thing", slug: "totally-different-thing" }, candidates);
  assert.equal(unrelated.decision, "NEW");
});

test("premium engine: premium brand + high price + good data = PREMIUM", () => {
  const p = premiumScore({ brand: "Apple", priceUsd: 1900, qualityScore: 0.9, rating: 4.9 });
  assert.equal(p.status, "PREMIUM");
  const cheap = premiumScore({ brand: "Generic", priceUsd: 9, qualityScore: 0.4, rating: 3 });
  assert.equal(cheap.status, "REJECTED");
});

test("search: synonyms, typo tolerance and zero-result fallback", () => {
  const catalog = [
    { id: "a", name: "iPhone 17 Pro", brand: "Apple", category: "Phones", premium_score: 95, rating: 4.9, stock_status: "IN_STOCK", premium_status: "PREMIUM" },
    { id: "b", name: "Sony WH-1000XM6 Headphones", brand: "Sony", category: "Audio", premium_score: 98, rating: 4.9, stock_status: "IN_STOCK", premium_status: "PREMIUM" },
    { id: "c", name: "MacBook Pro 16", brand: "Apple", category: "Computers", premium_score: 97, rating: 4.8, stock_status: "IN_STOCK", premium_status: "PREMIUM" },
  ];
  assert.equal(normalizeQuery("i phone 17"), "iphone 17");
  assert.equal(normalizeQuery("mac book pro"), "macbook pro");

  const synonym = searchCatalog(catalog, "i phone", { limit: 5 });
  assert.ok(synonym.results.length > 0);

  const typo = searchCatalog(catalog, "headfon", { limit: 5 });
  assert.equal(typo.results[0]?.id, "b");

  const zero = searchCatalog(catalog, "zzzzz", { limit: 5, fallbackLimit: 3 });
  assert.equal(zero.results.length, 0);
  assert.equal(zero.fallback.length, 3);

  // generic-noun typo resolves via category hint when the word is absent from product names
  const lean = [
    { id: "b", name: "Sony WH-1000XM6 VEYRO Edition", brand: "Sony", category: "Audio", premium_score: 98, rating: 4.9, stock_status: "IN_STOCK", premium_status: "PREMIUM" },
  ];
  const nounTypo = searchCatalog(lean, "headfon", { limit: 5 });
  assert.equal(nounTypo.results[0]?.id, "b");
});

test("pricing: margin, installments with visible total, currency conversion", () => {
  assert.equal(computeCustomerPrice(100), 130);
  const plan = buildInstallmentPlan(130, 5, 0.15);
  assert.equal(plan.totalPaid, plan.downPayment + plan.installmentAmount * 5);
  assert.equal(getPlanForOption(130, "pay_now").installmentCount, 0);
  assert.equal(convertPrice(100, "AED"), 367);
});

test("offer selection: reliable supplier beats raw cheapest", () => {
  const offers = [
    { id: "cheap", source_id: "s1", source_price: 340, shipping_cost: 0, stock_status: "IN_STOCK", supplier_score: 40, delivery_days: 30, countries: [] },
    { id: "solid", source_id: "s2", source_price: 350, shipping_cost: 0, stock_status: "IN_STOCK", supplier_score: 95, delivery_days: 3, countries: [] },
    { id: "far", source_id: "s3", source_price: 330, shipping_cost: 0, stock_status: "IN_STOCK", supplier_score: 80, delivery_days: 5, countries: ["US"] },
  ];
  const best = selectBestOffer(offers, "AE");
  assert.equal(best.id, "solid"); // cheapest is eligible for AE but scores worse overall
  assert.equal(selectBestOffer([offers[2]], "AE"), null); // country not eligible
});

test("levenshtein distance sanity", () => {
  assert.equal(levenshtein("headphnes", "headphones"), 1); // single typo
  assert.equal(levenshtein("abc", "abc"), 0);
});

test("json-ld extraction: real script tag wins, Next.js RSC payload fallback", () => {
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Test Laptop",
    sku: "TL-1",
    offers: { "@type": "Offer", price: "999", priceCurrency: "USD", availability: "https://schema.org/InStock" },
  };
  const real = `<script type="application/ld+json">${JSON.stringify(productLd)}</script>`;
  const docs1 = extractJsonLd(real);
  assert.equal(docs1.length, 1);
  assert.equal(docs1[0].name, "Test Laptop");

  // Next.js flight payload: the same JSON-LD escaped inside self.__next_f.push
  const escaped = JSON.stringify(productLd).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rsc = `<script>self.__next_f.push([1,"${escaped}"])</script>`;
  const docs2 = extractJsonLd(rsc);
  assert.equal(docs2.length, 1);
  assert.equal(docs2[0].name, "Test Laptop");
  assert.equal(docs2[0].offers.price, "999");

  // A real script tag always wins over the embedded fallback
  const realLd2 = { ...productLd, sku: "REAL-1", name: "Real Winner" };
  const rscLd = { ...productLd, sku: "RSC-1", name: "RSC Fallback" };
  const real2 = `<script type="application/ld+json">${JSON.stringify(realLd2)}</script>`;
  const escaped2 = JSON.stringify(rscLd).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rsc2 = `<script>self.__next_f.push([1,"${escaped2}"])</script>`;
  const docs3 = extractJsonLd(real2 + rsc2);
  assert.equal(docs3.length, 1); // RSC payload ignored when a real block exists
  assert.equal(docs3[0].name, "Real Winner");
});