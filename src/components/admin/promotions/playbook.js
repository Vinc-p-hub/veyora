// VEYRO promotion playbook — proven campaign shapes. Each `build()` returns a
// pre-filled promotion; nothing is created until the admin reviews and saves it.
import { Zap, Gift, Truck, LayoutGrid, Ticket, Crown } from "lucide-react";

const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();
const now = () => new Date().toISOString();

export const PLAYBOOK = [
  {
    icon: Zap, goal: "Create urgency", title: "Flash sale 48h",
    tip: "-15% on the whole catalog for 48 hours, capped at $150 per item. Pair it with a hero banner.",
    build: () => ({ name: "Flash sale 48h", label: "FLASH -15%", kind: "AUTOMATIC", discount_type: "PERCENT", value: 15, max_discount_usd: 150, scope: "ALL", starts_at: now(), ends_at: inDays(2) }),
  },
  {
    icon: Gift, goal: "Convert first visitors", title: "Welcome code",
    tip: "WELCOME10: -10% from $100, capped at $50. Share it in newsletters and social bios.",
    build: () => ({ name: "Welcome code", label: "Welcome -10%", kind: "COUPON", code: "WELCOME10", discount_type: "PERCENT", value: 10, min_order_usd: 100, max_discount_usd: 50, scope: "ALL", starts_at: now() }),
  },
  {
    icon: Truck, goal: "Raise average basket", title: "Free shipping threshold",
    tip: "Free shipping from $250 — customers add one more accessory to reach it.",
    build: () => ({ name: "Free shipping from $250", label: "FREE SHIPPING", kind: "AUTOMATIC", discount_type: "FREE_SHIPPING", value: 0, min_order_usd: 250, scope: "ALL", starts_at: now() }),
  },
  {
    icon: LayoutGrid, goal: "Push one category", title: "Category week",
    tip: "-20% on Gaming for 7 days. Rotate the category every week to keep the store fresh.",
    build: () => ({ name: "Gaming week", label: "GAMING WEEK -20%", kind: "AUTOMATIC", discount_type: "PERCENT", value: 20, scope: "CATEGORY", categories: ["Gaming"], starts_at: now(), ends_at: inDays(7) }),
  },
  {
    icon: Ticket, goal: "Close high-value carts", title: "Big-ticket coupon",
    tip: "SAVE50: $50 off orders from $800 — ideal for laptops, phones and cameras.",
    build: () => ({ name: "Big-ticket $50", label: "-$50", kind: "COUPON", code: "SAVE50", discount_type: "FIXED", value: 50, min_order_usd: 800, scope: "ALL", starts_at: now(), ends_at: inDays(30) }),
  },
  {
    icon: Crown, goal: "Loyalty & scarcity", title: "VIP limited code",
    tip: "VIP20: -20% capped at $150, limited to 50 orders. Send it to your best customers only.",
    build: () => ({ name: "VIP limited", label: "VIP -20%", kind: "COUPON", code: "VIP20", discount_type: "PERCENT", value: 20, max_discount_usd: 150, usage_limit: 50, scope: "ALL", starts_at: now(), ends_at: inDays(30) }),
  },
];