// Pushes the whole VEYRO backend (schema + data) to the connected Supabase
// project: creates the `veyro` schema, one table per Base44 entity (snake_case
// columns, jsonb for objects/arrays, id primary key), then upserts every row.
// Idempotent — safe to re-run anytime; existing rows are updated, never duplicated.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  getSupabaseContext, runSql, snakeCase, inferColumns, buildTableSql, buildUpsertSql,
} from "../../shared/integrations/supabase.js";

const SCHEMA = "veyro";
const ENTITY_NAMES = [
  "Product", "Offer", "Seller", "CrawlerSource", "CrawlerJob",
  "Order", "PaymentIntent", "PspWebhookEvent", "Refund", "Dispute",
  "Review", "SourceReview", "ReviewInvitation",
  "StockMovement", "AuditLog", "SearchQuery",
  "HeroSlide", "SiteSetting", "PricingConfig", "PricingChangeLog",
  "CurrencyRate", "CountryConfig", "SupportTicket", "WishlistItem", "User",
];
const ROW_LIMIT = 1000; // rows pushed per entity per run
const CHUNK_SIZE = 25; // rows per upsert statement

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const admin = base44.asServiceRole;

    const ctx = await getSupabaseContext(admin);
    await runSql(ctx, `CREATE SCHEMA IF NOT EXISTS ${SCHEMA};`);

    const results = [];
    for (const name of ENTITY_NAMES) {
      const table = `${SCHEMA}.${snakeCase(name)}`;
      try {
        const rows = await admin.entities[name].list("-created_date", ROW_LIMIT);
        if (!rows.length) {
          results.push({ entity: name, table, rows: 0, pushed: 0, status: "ok", note: "empty — table not created" });
          continue;
        }
        const columns = inferColumns(rows);
        await runSql(ctx, buildTableSql(table, columns));
        let pushed = 0;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          await runSql(ctx, buildUpsertSql(table, columns, rows.slice(i, i + CHUNK_SIZE)));
          pushed += Math.min(CHUNK_SIZE, rows.length - i);
        }
        results.push({ entity: name, table, rows: rows.length, pushed, status: "ok" });
      } catch (error) {
        results.push({ entity: name, table, status: "error", error: String(error.message || error).slice(0, 300) });
      }
    }

    const ok = results.filter((r) => r.status === "ok");
    await admin.entities.AuditLog.create({
      actor_email: user.email,
      actor_id: user.id,
      action: "SUPABASE_PUSH_BACKEND",
      target_type: "supabase",
      target_id: ctx.ref,
      details: `entities_ok=${ok.length}/${ENTITY_NAMES.length} rows=${ok.reduce((s, r) => s + r.rows, 0)}`,
    }).catch(() => {});

    return Response.json({
      ok: results.every((r) => r.status === "ok"),
      project: `${ctx.ref} (${ctx.projectName || ""})`.trim(),
      schema: SCHEMA,
      note: rows_limit_note(ROW_LIMIT),
      entities: results,
    });
  } catch (error) {
    return Response.json({ error: error.message || "Supabase push failed" }, { status: 500 });
  }
}

function rows_limit_note(limit) {
  return `Idempotent upsert — re-run anytime. The ${limit}-most-recent rows per entity are pushed per run.`;
}