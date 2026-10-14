import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

// Pull the CSV parser out of the Edge Function runtime and exercise it on awkward input.
const src = fs.readFileSync(new URL("../supabase/functions/_shared/runtime.ts", import.meta.url), "utf8");
const body = src.slice(src.indexOf("export function parseCsv"), src.indexOf("// Reads an uploaded CSV"));
const parseCsv = new Function(transformSync(body.replace("export function", "function"), { loader: "ts" }).code + "; return parseCsv;")();

test("quoted commas, escaped quotes, CRLF and BOM", () => {
  const rows = parseCsv('\uFEFFproduct,author,rating,text\r\nslug-a,"Marie, L.",5,"Great ""value"", fast"\r\nslug-b,Ali,4,ok\r\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].author, "Marie, L.");
  assert.equal(rows[0].text, 'Great "value", fast');
  assert.equal(rows[1].product, "slug-b");
});

test("semicolon delimiter (Excel in French locales) and multi-line cell", () => {
  const rows = parseCsv('product;author;text\nslug-a;Sam;"line1\nline2"\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].text, "line1\nline2");
});

test("the customer's file is read completely", { skip: !fs.existsSync("/mnt/user-data/uploads/veyro_reviews_all_products.csv") }, () => {
  const rows = parseCsv(fs.readFileSync("/mnt/user-data/uploads/veyro_reviews_all_products.csv", "utf8"));
  assert.equal(rows.length, 82);
  assert.deepEqual(Object.keys(rows[0]), ["product", "author", "rating", "text", "source_name", "review_date", "review_url"]);
});
