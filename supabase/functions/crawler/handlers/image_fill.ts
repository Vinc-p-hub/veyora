// Fills missing product images from REAL source image URLs: downloads the
// image server-side, stores it in VEYRO's own storage (CSP-safe internal URL)
// and sets it as the product's main image. Admin-only. Images are never
// generated, duplicated or invented — only real files from the given URL.
import { createContext, waitUntil } from "../../_shared/runtime.ts";

const MAX_ITEMS = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export default async function handler(req: Request): Promise<Response> {
  try {
    const __ctx = await createContext(req);
    const user = __ctx.user;
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    if (!items.length) return Response.json({ error: "items required" }, { status: 400 });

    const admin = __ctx.admin;
    const results = [];
    for (const item of items) {
      const productId = String((item && item.product_id) || "");
      const imageUrl = String((item && item.image_url) || "");
      const base = { product_id: productId };
      if (!productId || !imageUrl) {
        results.push({ ...base, ok: false, error: "product_id and image_url required" });
        continue;
      }
      try {
        let origin = "";
        try { origin = new URL(imageUrl).origin + "/"; } catch (_e) { /* keep empty */ }
        const res = await fetch(imageUrl, { headers: { "User-Agent": UA, Referer: origin } });
        if (!res.ok) {
          results.push({ ...base, ok: false, error: `image fetch failed (${res.status})` });
          continue;
        }
        const type = (res.headers.get("content-type") || "").split(";")[0].trim();
        if (!type.startsWith("image/")) {
          results.push({ ...base, ok: false, error: "URL is not an image" });
          continue;
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_IMAGE_BYTES) {
          results.push({ ...base, ok: false, error: "image too large" });
          continue;
        }
        const ext = (imageUrl.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i) || [, "jpg"])[1].toLowerCase();
        const file = new File([buf], `veyro-product-${productId.slice(-8)}.${ext}`, { type });
        const up = await admin.integrations.Core.UploadPublicFile({ file });
        await admin.entities.Product.update(productId, {
          image_url: up.file_url,
          image_status: "COMPLETE",
        });
        results.push({ ...base, ok: true, image_url: up.file_url });
      } catch (e) {
        results.push({ ...base, ok: false, error: String(e.message || e).slice(0, 200) });
      }
    }

    return Response.json({ ok: results.every((r) => r.ok), results });
  } catch (error) {
    return Response.json({ error: error.message || "productImageFill failed" }, { status: 500 });
  }
}