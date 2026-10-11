import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { api } from "@/api/client";
import { loadScript } from "@/lib/loadScript";

// Paystack inline popup: the payment happens in an overlay on this page (no redirect).
// The server verifies the transaction reference before the order is marked PAID.
export default function PaystackCheckout({ orderNumber, onPaid }) {
  const sessionRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | paying | confirming | pending | error
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.functions.invoke("payments", { action: "create", provider: "paystack", order_number: orderNumber });
        const d = res.data || {};
        if (!d.ok) throw new Error(d.error || "Payment could not be started");
        await loadScript("https://js.paystack.co/v2/inline.js", "PaystackPop");
        if (cancelled) return;
        sessionRef.current = d;
        setInfo(d);
        setPhase("ready");
      } catch (e) {
        if (!cancelled) { setError(e.message || "Payment could not be started"); setPhase("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [orderNumber]);

  const confirm = async () => {
    setPhase("confirming");
    try {
      const cap = await api.functions.invoke("payments", { action: "confirm", provider: "paystack", external_id: sessionRef.current.external_id });
      if (cap.data?.ok && !cap.data.pending) onPaid?.();
      else if (cap.data?.pending) setPhase("pending");
      else throw new Error(cap.data?.error || "Payment could not be confirmed");
    } catch (e) {
      setError(e.message || "Payment could not be confirmed");
      setPhase("ready");
    }
  };

  const pay = () => {
    setError("");
    setPhase("paying");
    const popup = new window.PaystackPop();
    popup.resumeTransaction(sessionRef.current.access_code, {
      onSuccess: confirm,
      onCancel: () => setPhase("ready"),
      onError: (err) => { setError(err?.message || "Payment failed"); setPhase("ready"); },
    });
  };

  return (
    <div className="space-y-4">
      {phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Preparing secure payment…</div>
      )}
      {phase === "confirming" && <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Confirming your payment…</div>}
      {phase === "pending" && <p className="text-sm">Your payment is being processed. Your order will be confirmed automatically once it clears.</p>}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {(phase === "ready" || phase === "paying") && info && (
        <button onClick={pay} disabled={phase === "paying"}
          className="w-full py-3 rounded-lg bg-noon text-noon-fg text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
          <Lock className="w-4 h-4" />
          Pay {Number(info.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {info.currency}
        </button>
      )}
    </div>
  );
}
