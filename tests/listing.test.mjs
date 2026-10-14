import test from "node:test";
import assert from "node:assert/strict";
import { extractProductLinks } from "../supabase/functions/_shared/catalog/extract.js";

const html = `<html><head><script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","url":"https://shop.test/apple-iphone-17-pro-256gb"}]}</script></head><body>
<a href="/">Home</a><a href="/cart">Cart</a><a href="/all-brands">Brands</a><a href="/blog/news">Blog</a>
<a href="/products/samsung-galaxy-s26-ultra">S26</a><a href="/shop/buy-ipad-air-11-inch">iPad</a>
<a href="https://other.test/products/x">other host</a><a href="/img/a.png">img</a>
<a href="/google-pixel-10-pro-xl-256gb?utm_source=x">Pixel</a></body></html>`;

test("extracts product links from listing pages, ignores navigation/other hosts/assets", () => {
  const links = extractProductLinks(html, "https://shop.test/all");
  assert.ok(links.includes("https://shop.test/apple-iphone-17-pro-256gb"), "JSON-LD ItemList entry");
  assert.ok(links.includes("https://shop.test/products/samsung-galaxy-s26-ultra"));
  assert.ok(links.includes("https://shop.test/shop/buy-ipad-air-11-inch"));
  assert.ok(links.includes("https://shop.test/google-pixel-10-pro-xl-256gb"), "tracking params dropped");
  for (const bad of ["/cart", "/all-brands", "/blog/news", "other.test", ".png"]) assert.ok(!links.some((l) => l.includes(bad)), bad);
});
