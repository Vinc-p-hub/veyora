// Runtime helpers for Supabase Edge Functions: CORS, auth context, and an entity-style
// data API over the service-role client (same shape as the storefront adapter).
import { createClient } from "npm:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Wrap a handler: preflight, CORS on every response (incl. errors), no stack leaks.
export function serve(handler: (req: Request) => Promise<Response> | Response) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    let res: Response;
    try {
      res = await handler(req);
    } catch (e) {
      console.error(e);
      res = Response.json({ error: (e as Error).message || "Server error" }, { status: 500 });
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  });
}

export const waitUntil = (p: Promise<unknown>) => {
  try {
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil(p);
  } catch { /* best effort */ }
};

const TABLES: Record<string, string> = {
  AuditLog: "audit_logs", CountryConfig: "country_configs", CrawlerJob: "crawler_jobs",
  CrawlerSource: "crawler_sources", CurrencyRate: "currency_rates", Dispute: "disputes",
  GithubProject: "github_projects", GithubPullRequest: "github_pull_requests",
  HeroSlide: "hero_slides", Offer: "offers", Order: "orders", PaymentIntent: "payment_intents",
  PricingChangeLog: "pricing_change_logs", PricingConfig: "pricing_configs", Product: "products",
  Promotion: "promotions", PspCredential: "psp_credentials", PspWebhookEvent: "psp_webhook_events",
  Refund: "refunds", Review: "reviews", ReviewInvitation: "review_invitations",
  SearchQuery: "search_queries", Seller: "sellers", SiteSetting: "site_settings",
  SourceReview: "source_reviews", StockMovement: "stock_movements", SupportTicket: "support_tickets",
  WishlistItem: "wishlist_items", User: "profiles",
};

export const serviceClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// deno-lint-ignore no-explicit-any
function entity(db: any, name: string) {
  const table = TABLES[name];
  // deno-lint-ignore no-explicit-any
  const ok = ({ data, error }: any) => {
    if (error) throw new Error(`${name}: ${error.message}`);
    return data;
  };
  // deno-lint-ignore no-explicit-any
  const select = async (query: Record<string, any> = {}, sort?: string | null, limit?: number) => {
    let q = db.from(table).select("*");
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) q = q.in(k, v);
      else if (v === null) q = q.is(k, null);
      else q = q.eq(k, v);
    }
    if (sort) q = q.order(sort.replace(/^-/, ""), { ascending: !sort.startsWith("-") });
    if (limit) q = q.limit(limit);
    return ok(await q) || [];
  };
  return {
    list: (sort?: string | null, limit?: number) => select({}, sort, limit),
    filter: select,
    async get(id: string) {
      const row = ok(await db.from(table).select("*").eq("id", id).maybeSingle());
      if (!row) throw new Error(`${name} not found`);
      return row;
    },
    // deno-lint-ignore no-explicit-any
    async create(data: any) {
      return ok(await db.from(table).insert(data).select().single());
    },
    // deno-lint-ignore no-explicit-any
    async bulkCreate(rows: any[]) {
      if (!rows.length) return [];
      return ok(await db.from(table).insert(rows).select());
    },
    // deno-lint-ignore no-explicit-any
    async update(id: string, data: any) {
      const row = ok(await db.from(table).update(data).eq("id", id).select().maybeSingle());
      if (!row) throw new Error(`${name} ${id} not found`);
      return row;
    },
    // deno-lint-ignore no-explicit-any
    async bulkUpdate(items: any[]) {
      // deno-lint-ignore no-explicit-any
      return Promise.all(items.map(({ id, data, ...rest }: any) => this.update(id, data || rest)));
    },
    async delete(id: string) {
      ok(await db.from(table).delete().eq("id", id));
      return { id };
    },
  };
}

export function entitiesOf(db = serviceClient()) {
  // deno-lint-ignore no-explicit-any
  const cache: Record<string, any> = {};
  return new Proxy({}, {
    get: (_t, name: string) => (TABLES[name] ? (cache[name] ||= entity(db, name)) : undefined),
    // deno-lint-ignore no-explicit-any
  }) as Record<string, any>;
}

// Caller identity from the Authorization bearer (null for anonymous / publishable-key calls).
export async function getUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token.startsWith("sb_publishable")) return null;
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profile } = await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email,
    full_name: profile?.full_name || "",
    role: profile?.role || "user",
    staff_role: profile?.staff_role || null,
  };
}

// ───────────── file helpers (replace the old hosted "integrations.Core") ─────────────
const BUCKET = "public-uploads";

// Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF, BOM, ; or , or tab delimiter).
export function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0] || "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length]).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as string;
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// Reads an uploaded CSV / JSON / XLSX (by URL) into row objects.
async function extractData({ file_url }: { file_url: string }) {
  const res = await fetch(file_url);
  if (!res.ok) return { status: "error", details: `The file could not be downloaded (${res.status})` };
  const name = file_url.split("?")[0].toLowerCase();
  const type = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (name.endsWith(".json") || type.includes("json")) {
      const data = JSON.parse(await res.text());
      return { status: "success", output: Array.isArray(data) ? data : data?.reviews || data };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || type.includes("spreadsheetml") || type.includes("ms-excel") && !name.endsWith(".csv")) {
      const XLSX = await import("npm:xlsx@0.18.5");
      const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
      return { status: "success", output: raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]))) };
    }
    return { status: "success", output: parseCsv(await res.text()) };
  } catch (e) {
    return { status: "error", details: `The file could not be read: ${(e as Error).message}` };
  }
}

// Re-hosts a file in the public bucket and returns its public URL.
// deno-lint-ignore no-explicit-any
async function uploadPublicFile(db: any, { file }: { file: File }) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `server/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { file_url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string };
}

export async function createContext(req: Request) {
  const db = serviceClient();
  const admin = {
    entities: entitiesOf(db),
    integrations: { Core: { ExtractDataFromUploadedFile: extractData, UploadPublicFile: (a: { file: File }) => uploadPublicFile(db, a) } },
  };
  return { user: await getUser(req), admin, db };
}
