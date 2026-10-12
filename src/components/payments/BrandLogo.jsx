import React from "react";
import { BRAND_PATHS } from "@/lib/paymentBrandPaths";

const LABELS = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", paypal: "PayPal", applepay: "Apple Pay", googlepay: "Google Pay", discover: "Discover" };

// Real brand marks on a transparent background (no tile, no box). `height` in px.
export default function BrandLogo({ id, height = 22, className = "" }) {
  const label = LABELS[id] || id;

  // Mastercard: the two interlocked circles, drawn in the official colours.
  if (id === "mastercard") {
    return (
      <svg role="img" aria-label={label} viewBox="0 0 48 30" height={height} width={(height * 48) / 30} className={className}>
        <title>{label}</title>
        <circle cx="17" cy="15" r="13" fill="#EB001B" />
        <circle cx="31" cy="15" r="13" fill="#F79E1B" />
        <path d="M24 4.05A13 13 0 0 1 24 25.95A13 13 0 0 1 24 4.05Z" fill="#FF5F00" />
      </svg>
    );
  }

  const brand = BRAND_PATHS[id];
  if (!brand) return null;
  const [, , w, h] = brand.viewBox.split(" ").map(Number);
  // Apple Pay is black by brand: follow the surrounding text colour so it stays visible on any footer.
  const fill = id === "applepay" ? "currentColor" : `#${brand.hex}`;
  return (
    <svg role="img" aria-label={label} viewBox={brand.viewBox} height={height} width={(height * w) / h} className={className}>
      <title>{label}</title>
      <path d={brand.path} fill={fill} />
    </svg>
  );
}
