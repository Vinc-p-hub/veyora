export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const body = `User-agent: *
Allow: /

# Private / transactional areas — never indexed
Disallow: /admin
Disallow: /checkout
Disallow: /cart
Disallow: /orders
Disallow: /profile
Disallow: /payment-methods
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
