import React from "react";
import PayPalCheckout from "@/components/payments/PayPalCheckout";
import StripeCheckout from "@/components/payments/StripeCheckout";
import PaystackCheckout from "@/components/payments/PaystackCheckout";

// Providers whose payment form is embedded in the page (no redirect).
export const EMBEDDED_PROVIDERS = ["paypal", "stripe", "paystack"];

export default function PaymentEmbed({ provider, orderNumber, onPaid }) {
  if (provider === "stripe") return <StripeCheckout orderNumber={orderNumber} onPaid={onPaid} />;
  if (provider === "paystack") return <PaystackCheckout orderNumber={orderNumber} onPaid={onPaid} />;
  return <PayPalCheckout orderNumber={orderNumber} onPaid={onPaid} />;
}
