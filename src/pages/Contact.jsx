import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { applySeo } from "@/lib/seo";

// Contact — how customers reach the real VEYRO customer service team.
export default function Contact() {
  useEffect(() => {
    applySeo({
      title: "Contact VEYRO — customer service & support",
      description: "Reach the VEYRO customer service team through the support center — orders, deliveries, warranty and review questions.",
      path: "/contact",
    });
  }, []);

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-3xl mx-auto">
      <Link to="/" className="text-xs text-text-muted hover:text-text-primary">← VEYRO</Link>
      <h1 className="font-display font-bold text-2xl md:text-3xl mt-4">Contact us</h1>
      <p className="text-sm text-text-muted mt-3 leading-relaxed">
        The fastest way to reach the VEYRO customer service team is our support center. Open a ticket with your
        order number and we&apos;ll get back to you — typical response time is under 48 hours.
      </p>

      <Link
        to="/support"
        className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-noon text-noon-fg text-sm font-semibold hover:opacity-90 transition"
      >
        <MessageSquare className="w-4 h-4" /> Open a support ticket
      </Link>

      <div className="grid sm:grid-cols-3 gap-3 mt-8">
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <Truck className="w-5 h-5 text-accent-cyan mb-2" />
          <div className="text-sm font-semibold">Orders & delivery</div>
          <div className="text-xs text-text-muted mt-1 leading-snug">Order status, tracking and delivery questions — include your order number.</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <RefreshCw className="w-5 h-5 text-accent-cyan mb-2" />
          <div className="text-sm font-semibold">Returns & warranty</div>
          <div className="text-xs text-text-muted mt-1 leading-snug">30-day returns and warranty claims are handled end-to-end by our team.</div>
        </div>
        <div className="bg-surface-card border border-border-hairline rounded-lg p-4">
          <ShieldCheck className="w-5 h-5 text-accent-cyan mb-2" />
          <div className="text-sm font-semibold">Reviews & trust</div>
          <div className="text-xs text-text-muted mt-1 leading-snug">Report a review or ask about Verified Buyer status — see our reviews policy.</div>
        </div>
      </div>

      <div className="mt-8 text-xs text-text-muted">
        Who sells and ships your order is shown on every product page and recorded on your order. See the{" "}
        <Link to="/legal" className="text-accent-cyan hover:underline">legal center</Link> for all policies.
      </div>
    </div>
  );
}