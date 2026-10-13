// Smoke test: mounts the real app in jsdom and visits the key routes. Fails if the global
// error boundary shows ("Something went wrong") or React logs a render error.
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "node_modules/.cache/smoke.bundle.mjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(path.join(root, "node_modules/.cache/harness.jsx"), `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "${path.join(root, "src/App.jsx")}";
import ErrorBoundary from "${path.join(root, "src/components/ErrorBoundary.jsx")}";
export function mount(el) { const r = createRoot(el); r.render(<ErrorBoundary><App /></ErrorBoundary>); return r; }
`);

await build({
  entryPoints: [path.join(root, "node_modules/.cache/harness.jsx")],
  bundle: true, format: "esm", platform: "browser", outfile: out, jsx: "automatic", logLevel: "error",
  alias: { "@": path.join(root, "src") },
  loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl" },
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});

const ROUTES = ["/", "/category", "/category?cat=Laptops", "/product/does-not-exist", "/cart", "/checkout", "/orders", "/profile", "/wishlist", "/login", "/register", "/forgot-password", "/support", "/return-policy", "/payment-methods"];
const errors = [];
let failed = 0;

for (const route of ROUTES) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost" + route, pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, localStorage: w.localStorage, sessionStorage: w.sessionStorage, location: w.location, history: w.history, HTMLElement: w.HTMLElement, Node: w.Node, MutationObserver: w.MutationObserver, getComputedStyle: w.getComputedStyle.bind(w), requestAnimationFrame: w.requestAnimationFrame.bind(w), cancelAnimationFrame: w.cancelAnimationFrame.bind(w), Event: w.Event, CustomEvent: w.CustomEvent });
  // Expose the rest of the DOM constructors (SVGElement, Element, ...) the way a browser does.
  for (const k of Object.getOwnPropertyNames(w)) if (/^[A-Z]/.test(k) && !(k in globalThis)) globalThis[k] = w[k];
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  globalThis.matchMedia = w.matchMedia;
  globalThis.IntersectionObserver = globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.scrollTo = () => {};
  // Realtime sockets are not needed for a render check.
  globalThis.WebSocket = w.WebSocket = class { constructor() { this.readyState = 3; } send() {} close() {} addEventListener() {} removeEventListener() {} };
  w.IntersectionObserver = w.ResizeObserver = globalThis.IntersectionObserver;
  // Every network call answers with an empty-but-valid payload.
  globalThis.fetch = w.fetch = async (url) => new Response(String(url).includes("/functions/") ? JSON.stringify({ ok: true, providers: [{ id: "paypal", label: "PayPal" }], products: [], items: [] }) : "[]", { status: 200, headers: { "Content-Type": "application/json" } });
  const origError = console.error;
  const seen = [];
  console.error = (...a) => { const m = a.map(String).join(" "); if (/UI error|The above error occurred|Uncaught/.test(m)) seen.push(m.slice(0, 300)); };

  const mod = await import(pathToFileURL(out).href + "?r=" + Date.now());
  const r = mod.mount(w.document.getElementById("root"));
  await new Promise((res) => setTimeout(res, 700));
  const text = w.document.body.textContent || "";
  const crashed = text.includes("Something went wrong") || seen.length > 0;
  console.error = origError;
  if (crashed) { failed++; errors.push(`${route}: ${seen[0] || "error boundary shown"}`); }
  console.log(`${crashed ? "FAIL" : "ok  "} ${route}`);
  r.unmount();
  w.close();
}
if (failed) { console.error("\n" + errors.join("\n")); process.exit(1); }
console.log("\nsmoke: all routes render");
process.exit(0);
