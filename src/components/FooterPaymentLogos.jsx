import React from "react";
import BrandLogo from "@/components/payments/BrandLogo";
import { acceptedLogos } from "@/lib/paymentMethods";
import { useConnectedProviders } from "@/lib/useConnectedProviders";

// "We accept" strip: real brand marks on a transparent background, limited to what the
// connected payment providers actually accept. Hidden while no provider is connected.
export default function FooterPaymentLogos() {
  const providers = useConnectedProviders();
  const logos = acceptedLogos(providers);
  if (!logos.length) return null;

  return (
    <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start" aria-label="Accepted payment methods">
      <span className="text-[11px] font-semibold">We accept</span>
      {logos.map((id) => (
        <BrandLogo key={id} id={id} height={id === "paypal" ? 20 : 24} />
      ))}
    </div>
  );
}
