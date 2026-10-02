// Catalog of African payment providers (+ PayPal) that VEYRO can connect from
// the back office. Each entry only declares WHICH credentials a provider needs
// and how they are labelled — the outbound API call for a provider is wired in
// psp.js once its contract is provided. Credential VALUES are stored
// server-side only (PspCredential, client-unreadable) and the back office never
// receives more than a masked preview.

import { getPsp } from "./psp.js";

const secret = (key, label, extra = {}) => ({ key, label, type: "secret", required: true, ...extra });
const text = (key, label, extra = {}) => ({ key, label, type: "text", required: true, ...extra });

export const PSP_CATALOG = [
  {
    id: "paystack",
    label: "Paystack",
    region: "Nigeria · Ghana · South Africa · Kenya",
    fields: [
      text("public_key", "Public key"),
      secret("secret_key", "Secret key"),
    ],
  },
  {
    id: "flutterwave",
    label: "Flutterwave",
    region: "Pan-African",
    fields: [
      text("public_key", "Public key"),
      secret("secret_key", "Secret key"),
      secret("secret_hash", "Secret hash (webhook validation)", { required: false }),
    ],
  },
  {
    id: "payunit",
    label: "PayUnit",
    region: "Cameroon · Central Africa",
    // PayUnit authenticates with x-api-key plus Basic(api_user:api_password).
    fields: [
      text("api_user", "API user"),
      text("api_key", "API key (x-api-key)"),
      secret("api_password", "API password"),
    ],
  },
  {
    id: "campay",
    label: "Campay",
    region: "Cameroon · Central Africa",
    fields: [
      text("app_username", "App username"),
      secret("app_password", "App password"),
      secret("permanent_token", "Permanent access token", { required: false }),
    ],
  },
  {
    id: "monnify",
    label: "Monnify",
    region: "Nigeria",
    fields: [
      text("api_key", "API key"),
      secret("secret_key", "Secret key"),
      text("contract_code", "Contract code"),
    ],
  },
  {
    id: "korapay",
    label: "Korapay",
    region: "Nigeria · Kenya",
    fields: [
      text("public_key", "Public key"),
      secret("secret_key", "Secret key"),
    ],
  },
  {
    id: "interswitch",
    label: "Interswitch",
    region: "Nigeria",
    fields: [
      text("client_id", "Client ID"),
      secret("client_secret", "Client secret"),
      text("merchant_code", "Merchant code"),
      text("pay_item_id", "Pay item ID"),
    ],
  },
  {
    id: "dpopay",
    label: "DPO Pay",
    region: "Pan-African",
    fields: [
      secret("company_token", "Company token"),
      text("service_type", "Service type"),
    ],
  },
  {
    id: "payfast_za",
    label: "Payfast",
    region: "South Africa",
    fields: [
      text("merchant_id", "Merchant ID"),
      secret("merchant_key", "Merchant key"),
      secret("passphrase", "Passphrase", { required: false }),
    ],
  },
  {
    id: "yoco",
    label: "Yoco",
    region: "South Africa",
    fields: [
      secret("secret_key", "Secret key"),
    ],
  },
  {
    id: "peach",
    label: "Peach Payments",
    region: "South Africa",
    fields: [
      text("entity_id", "Entity ID"),
      secret("access_token", "Access token"),
    ],
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    region: "Kenya · Tanzania · Mozambique · DRC · Egypt",
    fields: [
      text("consumer_key", "Consumer key"),
      secret("consumer_secret", "Consumer secret"),
      text("shortcode", "Business shortcode"),
      secret("passkey", "Lipa na M-Pesa passkey"),
    ],
  },
  {
    id: "airtel_money",
    label: "Airtel Money",
    region: "Pan-African",
    fields: [
      text("client_id", "Client ID"),
      secret("client_secret", "Client secret"),
    ],
  },
  {
    id: "mtn_momo",
    label: "MTN MoMo",
    region: "Pan-African",
    fields: [
      secret("subscription_key", "Subscription key"),
      text("api_user", "API user"),
      secret("api_key", "API key"),
    ],
  },
  {
    id: "orange_money",
    label: "Orange Money",
    region: "West & Central Africa",
    fields: [
      text("client_id", "Client ID"),
      secret("client_secret", "Client secret"),
      secret("merchant_key", "Merchant key"),
    ],
  },
  {
    id: "wave",
    label: "Wave",
    region: "Senegal · Côte d'Ivoire · Mali · Burkina Faso",
    fields: [
      secret("api_key", "API key"),
    ],
  },
  {
    id: "chipper_cash",
    label: "Chipper Cash",
    region: "Pan-African",
    fields: [
      text("client_id", "Client ID"),
      secret("client_secret", "Client secret"),
    ],
  },
  {
    id: "fawry",
    label: "Fawry",
    region: "Egypt",
    fields: [
      text("merchant_code", "Merchant code"),
      secret("security_key", "Security key"),
    ],
  },
  {
    id: "paymob",
    label: "Paymob",
    region: "Egypt · Middle East",
    fields: [
      secret("api_key", "API key"),
      text("integration_id", "Integration ID"),
      secret("hmac_secret", "HMAC secret"),
    ],
  },
  {
    id: "paypal",
    label: "PayPal",
    region: "Global",
    fields: [
      text("client_id", "Client ID"),
      secret("client_secret", "Client secret"),
      text("webhook_id", "Webhook ID", { required: false }),
    ],
  },
];

export function getProvider(id) {
  return PSP_CATALOG.find((p) => p.id === id) || null;
}

// The catalog lists what VEYRO intends to connect; the PSP registry lists what
// actually works today. A provider only becomes selectable at checkout once its
// adapter exists, so a customer can never pick a method that cannot complete.
export function isProviderImplemented(id) {
  return !!getPsp(id);
}