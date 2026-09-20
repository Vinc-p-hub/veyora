// Client-side SEO helper — unique title, meta description, canonical URL and
// structured data (JSON-LD). Structured data only ever carries information
// that is real and present on the page (no invented ratings or stock).
export function applySeo({ title, description, path, jsonLd }) {
  if (title) document.title = title;
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }
  const href = path ? `${window.location.origin}${path}` : window.location.href;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
  // One structured-data block per page — each page replaces the previous one.
  document.querySelectorAll("script[data-seo-jsonld]").forEach((s) => s.remove());
  if (jsonLd) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-jsonld", "true");
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}