// Brand artwork for the storefront payment strip. A provider with no artwork
// here falls back to its name on a plain tile — nothing is invented.
const MEDIA = "https://media.base44.com/images/public/6aae3bd1fa32640256bb8573/";

export const PAYMENT_LOGOS = {
  paypal: MEDIA + "f454275bd_PayPal-Logo-PNG-Picture.png",
  mtn_momo: MEDIA + "b6c50e398_1648544928638.png",
  orange_money: MEDIA + "db7363d3c_OIP.png",
  wave: MEDIA + "baf354663_logo_wave_circle_818.png",
};

// Card networks — accepted through any connected card provider.
export const CARD_NETWORKS = [
  { id: "cards", label: "Visa · Mastercard", url: MEDIA + "e26d77ba8_visa-and-mastercard-logo-26.png" },
  { id: "amex", label: "American Express", url: MEDIA + "2d4f8f9f4_generated_image.png" },
];