import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { DOCS, DOC_LINKS } from "@/lib/legalContent";
import { applySeo } from "@/lib/seo";

// Trust & legal pages — one component, one route per policy. The /legal hub
// lists every policy; each policy renders its real, current content.
export default function LegalPage({ doc }) {
  const key = DOCS[doc] ? doc : "legal";
  const content = DOCS[key];

  useEffect(() => {
    applySeo({
      title: `${content.title} | VEYRO`,
      description: content.summary,
      path: key === "legal" ? "/legal" : `/${key}`,
    });
  }, [key]);

  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-3xl mx-auto">
      <Link to="/" className="text-xs text-text-muted hover:text-text-primary">← VEYRO</Link>
      <h1 className="font-display font-bold text-2xl md:text-3xl mt-4">{content.title}</h1>
      <p className="text-xs text-text-muted mt-2">Last updated: {content.updated}</p>

      {key === "legal" ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-text-muted leading-relaxed">
            VEYRO is a transparent marketplace: every product is sold by an identified partner merchant or from
            VEYRO&apos;s own stock, prices are verified server-side, and reviews are never invented. The policies
            below explain exactly who sells, who ships, and how returns, refunds, warranty and reviews work.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            {DOC_LINKS.map((d) => (
              <Link
                key={d.slug}
                to={`/${d.slug}`}
                className="block bg-surface-card border border-border-hairline rounded-lg p-4 hover:border-accent-cyan/40 transition"
              >
                <div className="font-semibold text-sm">{d.title}</div>
                <div className="text-xs text-text-muted mt-1 leading-snug">{d.summary}</div>
              </Link>
            ))}
            <Link to="/contact" className="block bg-surface-card border border-border-hairline rounded-lg p-4 hover:border-accent-cyan/40 transition">
              <div className="font-semibold text-sm">Contact us</div>
              <div className="text-xs text-text-muted mt-1 leading-snug">Reach the VEYRO customer service team.</div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {content.sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display font-semibold text-lg mb-2">{s.h}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-text-muted leading-relaxed mb-2">{p}</p>
              ))}
            </section>
          ))}
          <div className="pt-4 border-t border-border-hairline text-xs text-text-muted">
            Questions? <Link to="/contact" className="text-accent-cyan hover:underline">Contact our support team</Link>.
          </div>
        </div>
      )}
    </div>
  );
}