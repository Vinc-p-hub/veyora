import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { api } from "@/api/client";

// Loads the PayPal JS SDK once per (client id, currency) pair.
const sdkCache = {};
function loadPayPalSdk(clientId, currency) {
  const key = `${clientId}:${currency}`;
  if (sdkCache[key]) return sdkCache[key];
  sdkCache[key] = new Promise((resolve, reject) => {
    document.querySelectorAll("script[data-veyro-paypal]").forEach((s) => s.remove());
    delete window.paypal;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.dataset.veyroPaypal = "1";
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK unavailable")));
    script.onerror = () => {
      delete sdkCache[key];
      reject(new Error("Could not load PayPal"));
    };
    document.head.appendChild(script);
  });
  return sdkCache[key];
}

// Embedded PayPal Checkout. The server creates the PayPal order from the stored VEYRO order
// and captures it after approval; the order flips to PAID only on the server's verified capture.
export default function PayPalCheckout({ orderNumber, onPaid }) {
  const containerRef = useRef(null);
  const buttonsRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | confirming | pending | error
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setError("");

    (async () => {
      try {
        const res = await api.functions.invoke("paypal", { action: "create_order", order_number: orderNumber });
        const d = res.data || {};
        if (!d.ok) throw new Error(d.error || "Payment could not be started");
        if (cancelled) return;
        setInfo(d);

        const paypal = await loadPayPalSdk(d.client_id, d.currency);
        if (cancelled || !containerRef.current) return;

        buttonsRef.current = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },
          createOrder: () => d.paypal_order_id,
          onApprove: async (data) => {
            setPhase("confirming");
            try {
              const cap = await api.functions.invoke("paypal", { action: "capture_order", paypal_order_id: data.orderID });
              if (cap.data?.ok && !cap.data.pending) onPaid?.();
              else if (cap.data?.pending) setPhase("pending");
              else throw new Error(cap.data?.error || "Payment could not be confirmed");
            } catch (e) {
              setError(e.message || "Payment could not be confirmed");
              setPhase("error");
            }
          },
          onCancel: () => setPhase("ready"),
          onError: () => {
            setError("PayPal reported a problem. Please try again.");
            setPhase("error");
          },
        });
        await buttonsRef.current.render(containerRef.current);
        if (!cancelled) setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Payment could not be started");
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      try { buttonsRef.current?.close?.(); } catch { /* already closed */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, attempt]);

  return (
    <div className="space-y-4">
      {info?.converted && (
        <p className="text-xs text-text-muted">
          PayPal does not support your local currency, so this payment is charged as{" "}
          <strong>{info.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {info.currency}</strong>.
        </p>
      )}

      {phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparing secure PayPal checkout…
        </div>
      )}

      {phase === "confirming" && (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Confirming your payment…
        </div>
      )}

      {phase === "pending" && (
        <p className="text-sm">
          Your payment is being processed by PayPal. Your order will be confirmed automatically once it clears.
        </p>
      )}

      {phase === "error" && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            {error}
            <button onClick={() => setAttempt((n) => n + 1)} className="ml-3 inline-flex items-center gap-1 underline">
              <RefreshCw className="w-3 h-3" /> Try again
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className={phase === "ready" ? "" : "hidden"} />
    </div>
  );
}
