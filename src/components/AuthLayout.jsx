import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Truck, CreditCard } from "lucide-react";

// VEYRO-branded auth layout: premium split screen on desktop (brand panel +
// form), stacked on mobile. Square corners, Poppins, noon-yellow accents.
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex bg-surface-primary">
      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex w-[44%] bg-noon-fg text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* The brand mark always leads back to the storefront */}
        <Link
          to="/"
          aria-label="VEYRO — back to the storefront"
          className="relative z-10 flex items-center gap-2.5 w-fit no-tap-highlight hover:opacity-80 transition"
        >
          <span className="w-9 h-9 bg-noon flex items-center justify-center">
            <span className="font-display font-extrabold text-noon-fg text-lg leading-none">V</span>
          </span>
          <span className="font-display font-bold text-xl tracking-tight">VEYRO</span>
        </Link>
        <div className="relative z-10">
          <h2 className="font-display font-bold text-3xl xl:text-4xl leading-tight max-w-md">
            International Premium Electronics
          </h2>
          <p className="text-white/60 text-sm mt-3 max-w-sm leading-relaxed">
            Transparent dynamic pricing, verified partner sellers and flexible installments — shipped worldwide.
          </p>
          <div className="space-y-3.5 mt-8">
            {[
              { icon: ShieldCheck, text: "Verified sellers · 2-year warranty" },
              { icon: CreditCard, text: "Pay now or in installments — total always visible" },
              { icon: Truck, text: "Worldwide delivery in 5–7 days" },
            ].map(({ icon: I, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <I className="w-4 h-4 text-noon" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-white/40">© {new Date().getFullYear()} VEYRO · All rights reserved</div>
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-noon/10" aria-hidden="true" />
        <div className="absolute -right-10 -bottom-32 w-96 h-96 rounded-full bg-noon/5" aria-hidden="true" />
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Mobile has no brand panel — the mark sits above the form instead */}
          <Link
            to="/"
            aria-label="VEYRO — back to the storefront"
            className="lg:hidden flex items-center justify-center gap-2.5 mb-6 no-tap-highlight"
          >
            <span className="w-8 h-8 bg-noon flex items-center justify-center">
              <span className="font-display font-extrabold text-noon-fg text-base leading-none">V</span>
            </span>
            <span className="font-display font-bold text-lg tracking-tight text-text-primary">VEYRO</span>
          </Link>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-noon mb-4">
              <Icon className="w-6 h-6 text-noon-fg" aria-hidden="true" />
            </div>
            <h1 className="font-display font-bold text-3xl tracking-tight text-text-primary">{title}</h1>
            {subtitle && <p className="text-text-muted text-sm mt-2">{subtitle}</p>}
          </div>
          <div className="bg-surface-card border border-border-hairline p-7 md:p-8">
            {children}
          </div>
          {footer && (
            <p className="text-center text-sm text-text-muted mt-6">{footer}</p>
          )}
          <p className="lg:hidden text-center text-[10px] text-text-muted mt-8 uppercase tracking-widest">
            VEYRO · Premium Electronics
          </p>
        </div>
      </div>
    </div>
  );
}