import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLang } from "@/lib/i18n";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#F0F0F3"/><text x="60" y="64" font-size="12" fill="#787C8D" text-anchor="middle" font-family="sans-serif">VEYRO</text></svg>'
  );

export default function Wishlist() {
  const { t } = useLang();
  const { currency } = useRegion();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await base44.entities.WishlistItem.list("-created_date", 100);
      const products = await Promise.all(
        list.map((i) => base44.entities.Product.get(i.product_id).catch(() => null))
      );
      setItems(list.map((i, idx) => ({ ...i, product: products[idx] })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.WishlistItem.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const remove = async (id) => {
    await base44.entities.WishlistItem.delete(id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <h1 className="font-display font-bold text-2xl md:text-3xl flex items-center gap-2">
        <Heart className="w-6 h-6 text-accent-cyan" /> {t("wishlist.title")}
      </h1>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> {t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-muted">{t("wishlist.empty")}</p>
          <p className="text-xs text-text-muted mt-1">{t("wishlist.emptyHint")}</p>
          <Link to="/category" className="inline-block mt-5 px-6 py-3 rounded-lg bg-noon text-noon-fg text-sm font-semibold hover:opacity-90">
            {t("wishlist.browse")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const p = item.product;
            const current = p?.customer_price;
            const added = item.price_at_add;
            const diff = current && added ? Math.round((current - added) * 100) / 100 : 0;
            return (
              <div key={item.id} className="flex items-center gap-4 bg-surface-card border border-border-hairline rounded-xl p-3">
                {p ? (
                  <Link to={`/product/${p.slug}`} className="shrink-0">
                    <img src={p.image_url || FALLBACK_IMG} alt="" className="w-16 h-16 rounded-lg object-cover bg-surface-secondary" />
                  </Link>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-surface-secondary flex items-center justify-center text-xs text-text-muted px-2 text-center">{t("wishlist.productGone")}</div>
                )}
                <div className="flex-1 min-w-0">
                  {p ? (
                    <>
                      <Link to={`/product/${p.slug}`} className="text-sm font-medium hover:text-accent-cyan">{p.name}</Link>
                      <div className="text-[11px] text-text-muted mt-0.5">{p.brand} · {t(`stock.${p.stock_status || "UNKNOWN"}`)}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="font-display font-bold">{formatPrice(current, currency)}</span>
                        {added && diff !== 0 && (
                          <span className={cn("flex items-center gap-0.5", diff < 0 ? "text-emerald-600" : "text-red-600")}>
                            {diff < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {t(diff < 0 ? "wishlist.down" : "wishlist.up")} ({formatPrice(Math.abs(diff), currency)})
                          </span>
                        )}
                        <span className="text-text-muted/70">· {t("wishlist.priceAtAdd")}: {added ? formatPrice(added, currency) : "—"}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-text-muted">{t("wishlist.productGone")}</span>
                  )}
                </div>
                <button onClick={() => remove(item.id)} className="text-xs text-red-600 hover:underline shrink-0">{t("wishlist.remove")}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}