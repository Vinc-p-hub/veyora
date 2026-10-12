import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { api } from "@/api/client";

// NexaPay embedded checkout (iframe — the customer never leaves the page).
// The iframe result is only a hint: the order flips to PAID exclusively when NexaPay's signed
// webhook is verified server-side. This component just waits for that confirmation.
export default function NexaPayCheckout({ orderNumber, onPaid }) {
  const [session, setSession] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | paying | confirming | failed
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const sessionRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const start = async () => {
    stopPolling();
    setPhase("loading");
    setError("");
    try {
      const res = await api.functions.invoke("payments", { action: "create", provider: "nexapay", order_number: orderNumber });
      const d = res.data || {};
      if (!d.ok || !d.checkout_url) throw new Error(d.error || "Payment session could not be created");
      sessionRef.current = d;
      setSession(d);
      setPhase("paying");
    } catch (e) {
      setError(e.message || "Payment session could not be created");
      setPhase("failed");
    }
  };

  useEffect(() => {
    start();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  const waitForServer = () => {
    if (pollRef.current) return;
    setPhase("confirming");
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const res = await api.functions.invoke("payments", { action: "confirm", provider: "nexapay", external_id: sessionRef.current.external_id });
        if (res.data?.ok && !res.data.pending) { stopPolling(); onPaid?.(); return; }
      } catch (e) {
        if (/cannot be confirmed/i.test(e.message || "")) {
          stopPolling();
          setError("The payment was rejected by the payment provider.");
          setPhase("failed");
          return;
        }
      }
      if (tries > 60) {
        stopPolling();
        setError("Confirmation is taking longer than expected — check your order in a few moments.");
        setPhase("failed");
      }
    }, 3000);
  };

  useEffect(() => {
    const onMessage = (e) => {
      if (!sessionRef.current || e.origin !== sessionRef.current.origin || !e.data) return;
      if (e.data.status === "succeeded") waitForServer();
      if (e.data.status === "failed") { setError(e.data.error || "The payment failed."); setPhase("failed"); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "loading") {
    return <div className="rounded-xl border border-border-hairline bg-surface-card p-10 text-center text-sm text-text-muted animate-pulse">Opening secure payment…</div>;
  }

  if (phase === "failed") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="w-6 h-6 mx-auto text-red-500 mb-2" />
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={start} className="mt-4 px-5 py-2.5 rounded-full bg-noon text-noon-fg text-sm font-semibold inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry payment
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phase === "confirming" && (
        <div className="rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 p-3 text-xs flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Payment received — verifying server-side…
        </div>
      )}
      <iframe src={session.checkout_url} title="NexaPay secure checkout" className="w-full max-w-[420px] mx-auto rounded-xl bg-surface-card" style={{ height: 640, border: 0 }} />
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
        <ShieldCheck className="w-3.5 h-3.5" /> Secured by NexaPay — payment confirmed server-side
      </div>
    </div>
  );
}
