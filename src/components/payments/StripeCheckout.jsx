import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { api } from "@/api/client";
import { loadScript } from "@/lib/loadScript";

// Embedded Stripe Payment Element. Redirect-based methods are disabled server-side, so the
// customer never leaves the page; the server verifies the PaymentIntent before marking PAID.
export default function StripeCheckout({ orderNumber, onPaid }) {
  const mountRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const intentRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | paying | pending | error
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.functions.invoke("payments", { action: "create", provider: "stripe", order_number: orderNumber });
        const d = res.data || {};
        if (!d.ok) throw new Error(d.error || "Payment could not be started");
        const Stripe = await loadScript("https://js.stripe.com/v3/", "Stripe");
        if (cancelled || !mountRef.current) return;
        intentRef.current = d.external_id;
        setAmount({ value: d.amount, currency: d.currency });
        stripeRef.current = Stripe(d.publishable_key);
        elementsRef.current = stripeRef.current.elements({ clientSecret: d.client_secret });
        elementsRef.current.create("payment", { layout: "tabs" }).mount(mountRef.current);
        setPhase("ready");
      } catch (e) {
        if (!cancelled) { setError(e.message || "Payment could not be started"); setPhase("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [orderNumber]);

  const pay = async () => {
    setPhase("paying");
    setError("");
    try {
      const { error: stripeError } = await stripeRef.current.confirmPayment({ elements: elementsRef.current, redirect: "if_required" });
      if (stripeError) throw new Error(stripeError.message || "Payment failed");
      const cap = await api.functions.invoke("payments", { action: "confirm", provider: "stripe", external_id: intentRef.current });
      if (cap.data?.ok && !cap.data.pending) onPaid?.();
      else if (cap.data?.pending) setPhase("pending");
      else throw new Error(cap.data?.error || "Payment could not be confirmed");
    } catch (e) {
      setError(e.message || "Payment failed");
      setPhase("ready");
    }
  };

  return (
    <div className="space-y-4">
      {phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Preparing secure card form…</div>
      )}
      {phase === "pending" && <p className="text-sm">Your payment is being processed. Your order will be confirmed automatically once it clears.</p>}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      <div ref={mountRef} className={phase === "ready" || phase === "paying" ? "" : "hidden"} />
      {(phase === "ready" || phase === "paying") && (
        <button onClick={pay} disabled={phase === "paying"}
          className="w-full py-3 rounded-full bg-noon text-noon-fg text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {phase === "paying" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Pay {amount ? `${Number(amount.value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${amount.currency}` : ""}
        </button>
      )}
    </div>
  );
}
