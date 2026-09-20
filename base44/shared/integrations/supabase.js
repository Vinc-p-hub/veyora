// Supabase Management API helpers — shared by all supabase-pushing functions.
// The OAuth connector token (database:write) is used server-side only.

const SUPABASE_API = "https://api.supabase.com/v1";

// Connector token + first project ref of the account (never ask the user for a ref).
export async function getSupabaseContext(admin) {
  const { accessToken } = await admin.connectors.getConnection("supabase");
  const res = await fetch(`${SUPABASE_API}/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Supabase projects fetch failed (HTTP ${res.status})`);
  const projects = await res.json();
  if (!Array.isArray(projects) || !projects.length) {
    throw new Error("No Supabase project found in the connected account");
  }
  return { accessToken, ref: projects[0].id, projectName: projects[0].name };
}

// Arbitrary SQL (SELECT / INSERT / DDL) — requires the database:write grant.
export async function runSql({ accessToken, ref }, query) {
  const res = await fetch(`${SUPABASE_API}/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase SQL error (HTTP ${res.status}): ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch (_e) {
    return text;
  }
}

export function snakeCase(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

// SQL literal serialization — injection-safe via quote doubling.
export function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const BUILTIN_COLUMNS = ["id", "created_date", "updated_date", "created_by_id"];

// Column types inferred from the actual data values (no schema API needed).
function columnType(value) {
  if (typeof value === "number") return "double precision";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "jsonb";
  return "text";
}

// Union of keys across all rows, with builtins first. Returns a plain
// object { snake_case_column: postgres_type } — stable ordering per run.
export function inferColumns(rows) {
  const types = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      const col = snakeCase(key);
      if (!types[col]) types[col] = columnType(value);
    }
  }
  const columns = {};
  for (const c of BUILTIN_COLUMNS) columns[c] = c === "id" ? "text" : c.endsWith("date") ? "timestamptz" : "text";
  for (const col of Object.keys(types)) {
    if (!(col in columns)) columns[col] = types[col];
  }
  return columns;
}

// CREATE TABLE IF NOT EXISTS + idempotent column adds for schema drift.
export function buildTableSql(tableName, columns) {
  const defs = Object.entries(columns).map(([name, type]) =>
    `"${name}" ${type}${name === "id" ? " NOT NULL PRIMARY KEY" : ""}`
  );
  const alters = Object.keys(columns)
    .filter((c) => c !== "id")
    .map((c) => `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${c}" ${columns[c]};`);
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${defs.join(", ")}); ${alters.join(" ")}`;
}

// Rows -> one idempotent upsert per chunk (ON CONFLICT (id) DO UPDATE).
export function buildUpsertSql(tableName, columns, chunk) {
  const cols = Object.keys(columns);
  const assignments = cols
    .filter((c) => c !== "id")
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");
  const values = chunk
    .map((row) => `(${cols.map((c) => sqlLiteral(row[c])).join(", ")})`)
    .join(", ");
  return `INSERT INTO ${tableName} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${values} ON CONFLICT ("id") DO UPDATE SET ${assignments};`;
}