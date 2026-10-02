// Promotion form helpers — record <-> form state conversion and shared constants.

export const INPUT =
  "w-full bg-surface-primary border border-border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-cyan/50";

export const CATEGORIES = [
  "Laptops", "Smartphones", "Tablets", "Headphones & Earbuds", "TVs & Monitors", "Cameras",
  "Gaming", "Smartwatches", "Audio", "Accessories", "Smart Home", "Networking",
  "Computer Components", "Phones", "Computers", "TV", "Wearables",
];

export const EMPTY_PROMO = {
  name: "", label: "", description: "", kind: "AUTOMATIC", code: "",
  discount_type: "PERCENT", value: 10, scope: "ALL", categories: [], brands: [], product_ids: [],
  min_order_usd: 0, max_discount_usd: 0, usage_limit: 0, starts_at: null, ends_at: null,
  priority: 5, active: true,
};

// ISO date -> value for <input type="datetime-local"> (local time)
function toLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function toFormState(p) {
  const r = { ...EMPTY_PROMO, ...p };
  return {
    ...r,
    code: r.code || "",
    label: r.label || "",
    description: r.description || "",
    brands: (r.brands || []).join(", "),
    categories: r.categories || [],
    product_ids: r.product_ids || [],
    starts_at: toLocal(r.starts_at),
    ends_at: toLocal(r.ends_at),
  };
}

export function toRecord(f) {
  const list = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    name: f.name.trim(),
    label: f.label.trim(),
    description: f.description.trim(),
    kind: f.kind,
    code: f.kind === "COUPON" ? f.code.trim().toUpperCase() : "",
    discount_type: f.discount_type,
    value: f.discount_type === "FREE_SHIPPING" ? 0 : Number(f.value) || 0,
    scope: f.scope,
    categories: f.scope === "CATEGORY" ? f.categories : [],
    brands: f.scope === "BRAND" ? list(f.brands) : [],
    product_ids: f.scope === "PRODUCT" ? f.product_ids : [],
    min_order_usd: Number(f.min_order_usd) || 0,
    max_discount_usd: Number(f.max_discount_usd) || 0,
    usage_limit: Number(f.usage_limit) || 0,
    starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
    ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    priority: Number(f.priority) || 5,
    active: !!f.active,
  };
}