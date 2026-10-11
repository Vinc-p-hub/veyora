// Guests have no account: remember their orders on this device so they can come back
// and pay or follow them. Server lookups always require the order number AND the e-mail.
const KEY = "veyro_guest_orders";

export function readGuestOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((o) => o && o.n && o.e) : [];
  } catch {
    return [];
  }
}

export function rememberGuestOrder(orderNumber, email) {
  try {
    const next = [{ n: orderNumber, e: String(email || "").trim().toLowerCase() }, ...readGuestOrders().filter((o) => o.n !== orderNumber)].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.setItem("veyro_email", String(email || "").trim().toLowerCase());
  } catch { /* storage unavailable: lookup form still works */ }
}
