// Customer-facing payment methods. Shoppers choose HOW they pay ("Card", "PayPal"), never a
// provider name: the card form is served by the best connected provider behind the scenes.
// Every provider listed here renders embedded in the page (no redirect).

const CARD_PROVIDER_PRIORITY = ["stripe", "paypal", "paystack", "nexapay"];

export function buildPaymentMethods(connected = []) {
  const has = (id) => connected.some((p) => p.id === id);
  const methods = [];
  const cardProvider = CARD_PROVIDER_PRIORITY.find(has);

  if (cardProvider) {
    const amex = cardProvider === "stripe" || cardProvider === "paypal";
    methods.push({
      id: "card",
      provider: cardProvider,
      funding: "card",
      label: "Card",
      desc: "Credit or debit card — pay securely without leaving this page",
      logos: ["visa", "mastercard", ...(amex ? ["amex"] : [])],
    });
  }
  // The PayPal wallet is a separate way to pay (PayPal account / balance).
  if (has("paypal")) {
    methods.push({
      id: "paypal",
      provider: "paypal",
      funding: "wallet",
      label: "PayPal",
      desc: "Pay with your PayPal account",
      logos: ["paypal"],
    });
  }
  return methods;
}

// Logos for the footer "We accept" strip — only what is genuinely accepted.
export function acceptedLogos(connected = []) {
  const has = (id) => connected.some((p) => p.id === id);
  if (!connected.length) return [];
  const logos = ["visa", "mastercard"];
  if (has("stripe") || has("paypal")) logos.push("amex");
  if (has("paypal")) logos.push("paypal");
  return logos;
}
