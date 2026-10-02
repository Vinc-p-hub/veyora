import React from "react";
import { Image } from "@/components/ui/image";
import { PAYMENT_LOGOS, CARD_NETWORKS } from "@/lib/paymentLogos";
import { useConnectedProviders } from "@/lib/useConnectedProviders";

function Tile({ url, label }) {
  return (
    <span
      title={label}
      className="h-10 min-w-[76px] px-2.5 rounded-md bg-white flex items-center justify-center"
    >
      {url ? (
        <Image src={url} alt={label} fittingType="fit" className="h-6 w-20" />
      ) : (
        <span className="text-[10px] font-semibold text-noon-fg whitespace-nowrap">{label}</span>
      )}
    </span>
  );
}

// Payment strip: card networks plus one tile per provider actually connected in
// the back office. Nothing is shown while no provider is connected.
export default function FooterPaymentLogos() {
  const providers = useConnectedProviders();
  if (!providers.length) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
      <span className="text-[11px] font-semibold me-1">We accept</span>
      {CARD_NETWORKS.map((c) => (
        <Tile key={c.id} url={c.url} label={c.label} />
      ))}
      {providers.map((p) => (
        <Tile key={p.id} url={PAYMENT_LOGOS[p.id]} label={p.label} />
      ))}
    </div>
  );
}