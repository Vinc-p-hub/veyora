// VEYRO internal stock allocation — kept strictly separate from real supplier
// stock data. When a supplier CONFIRMS a product is available, VEYRO grants
// itself an internal commercial allocation (default +10, configurable in the
// Super Admin via SiteSetting "stock_allocation_default"). This is a sellable
// ceiling chosen by VEYRO — it never claims the supplier physically holds that
// many units, and the real supplier stock status is never falsified.
export const ALLOCATION_SETTING_KEY = "stock_allocation_default";
export const DEFAULT_ALLOCATION = 10;

export async function getAllocationDefault(admin) {
  try {
    const rows = await admin.entities.SiteSetting.filter({ key: ALLOCATION_SETTING_KEY }, null, 1);
    const v = Number(rows && rows[0] && rows[0].value);
    if (Number.isFinite(v) && v >= 0) return v;
  } catch (_e) {
    /* fall back to the built-in default */
  }
  return DEFAULT_ALLOCATION;
}

// supplierStatus: the real crawled supplier stock status (IN_STOCK, LOW_STOCK…)
// existing: the current product record (null on create).
// Returns { veyro_allocated_stock, available_to_sell } — an internal allocation
// rule, never a claim about the supplier's real stock.
export function applyStockAllocation(supplierStatus, existing, defaultAllocation) {
  const prevAllocated =
    existing && Number(existing.veyro_allocated_stock) > 0
      ? Number(existing.veyro_allocated_stock)
      : Math.max(0, Number(defaultAllocation) || 0);
  const supplierAvailable = supplierStatus === "IN_STOCK" || supplierStatus === "LOW_STOCK";
  return {
    veyro_allocated_stock: prevAllocated,
    available_to_sell: supplierAvailable ? prevAllocated : 0,
  };
}

// FULFILLMENT_SOURCE selection: VEYRO's own physical stock ships first when
// enough unreserved units cover the quantity; otherwise the verified partner
// supplier fulfills the order. Real supplier stock is never mixed in.
export function selectFulfillmentSource(product, qty) {
  const veyroStock = Number(product && product.veyro_stock) || 0;
  const reserved = Number(product && product.reserved_stock) || 0;
  const free = Math.max(0, veyroStock - reserved);
  return free >= qty ? "VEYRO" : "SUPPLIER";
}

// Immutable inventory history — every real VEYRO stock change is logged.
export async function recordStockMovement(admin, movement) {
  try {
    await admin.entities.StockMovement.create({
      product_id: movement.product_id,
      product_name: movement.product_name || "",
      qty: movement.qty,
      old_stock: movement.old_stock,
      new_stock: movement.new_stock,
      reason: movement.reason,
      order_number: movement.order_number || "",
      actor_email: movement.actor_email || "",
    });
  } catch (_e) {
    /* history logging must never break the order flow */
  }
}