// Premium engine — decides what belongs in a premium electronics catalog.
// Inputs: brand reputation, price, data quality, rating. Outputs: score + status.

const PREMIUM_BRANDS = [
  "apple", "sony", "bose", "samsung", "leica", "bang & olufsen", "sennheiser",
  "canon", "nikon", "dyson", "asus", "rog", "lg", "marshall", "jbl", "shure",
  "microsoft", "dell", "xps", "lenovo", "hp", "garmin", "beats", "google",
];

export function premiumScore({ brand, priceUsd, qualityScore, rating }) {
  const b = String(brand || "").toLowerCase();
  const brandPts = PREMIUM_BRANDS.some((t) => b.includes(t)) ? 35 : b ? 15 : 0;
  const pricePts = priceUsd >= 800 ? 25 : priceUsd >= 300 ? 15 : priceUsd >= 100 ? 8 : 2;
  const qualityPts = Math.round((qualityScore || 0) * 25);
  const ratingPts = Math.round(((rating || 4.5) / 5) * 15);
  const score = Math.min(100, brandPts + pricePts + qualityPts + ratingPts);
  const status = score >= 80 ? "PREMIUM" : score >= 60 ? "APPROVED" : score >= 40 ? "REVIEW" : "REJECTED";
  return { score, status };
}