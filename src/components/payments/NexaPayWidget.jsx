import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { api } from "@/api/client";

const NEXAPAY_ORIGIN = "https://thankful-nexa-pay-flow.base44.app";

// NexaPay hosted checkout (iframe). The client NEVER confirms the payment:
// the iframe result is only a hint — the order flips to PAID exclusively when
// the signed PSP webhook (pspWebhook) validates the transaction server-side.
export default function NexaPayWidget({ orderNumber, onPaid }) {
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("paying"); // paying | confirming | failed
  const pollRef = useRef(null);

  const startSession = async (forceNew) => {
    setLoading(true);
    setError("");
    setPhase("paying");
    try {
      const res = await api.functions.invoke("pspCreateIntent", {
        order_number: orderNumber,
        provider: "nexapay",
        force_new: forceNew,
      });
      const d = res.data || {};
      if (!d.ok || !d.nexapay || !d.nexapay.checkout_url) {
        throw new Error(d.error || "Payment session could not be created");
      }
      setCheckoutUrl(d.nexapay.checkout_url);
    } catch (e) {
      setError(e.message || "Payment session could not be created");
      setPhase("failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  // Confirmation comes only from the server: poll the order until the signed
  // webhook flips it to PAID / PAYMENT_FAILED.
  const waitForServerConfirmation = () => {
    if (pollRef.current) return;
    setPhase("confirming");
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const orders = await api.entities.Order.filter({ order_number: orderNumber }, null, 1);
        const status = orders[0]?.status;
        if (status === "PAID") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          onPaid?.();
        } else if (status === "PAYMENT_FAILED") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError("The payment was rejected by the payment provider.");
          setPhase("failed");
        }
      } catch (_e) {
        /* keep polling */
      }
      if (tries > 60 && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setError("Confirmation is taking longer than expected — check your orders in a few moments.");
        setPhase("failed");
      }
    }, 3000);
  };

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== NEXAPAY_ORIGIN || !e.data) return;
      if (e.data.status === "succeeded") waitForServerConfirmation();
      if (e.data.status === "failed") {
        setError(e.data.error || "The payment failed.");
        setPhase("failed");
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-hairline bg-surface-card p-10 text-center text-sm text-text-muted animate-pulse">
        Opening secure payment…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phase === "failed" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => startSession(true)}
            className="mt-4 px-5 py-2.5 rounded-lg bg-noon text-noon-fg text-sm font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry payment
          </button>
        </div>
      ) : (
        <>
          {phase === "confirming" && (
            <div className="rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 p-3 text-xs text-text-primary flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Payment received — verifying server-side…
            </div>
          )}
          <iframe
            src={checkoutUrl}
            title="NexaPay secure checkout"
            className="w-full max-w-[420px] mx-auto rounded-xl bg-surface-card"
            style={{ height: 640, border: 0 }}
          />
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
            <ShieldCheck className="w-3.5 h-3.5" /> Secured by NexaPay — payment confirmed server-side
          </div>
        </>
      )}
      <p className="text-center text-xs text-text-muted">
        <Link to="/orders" className="underline">View my orders</Link>
      </p>
    </div>
  );
}