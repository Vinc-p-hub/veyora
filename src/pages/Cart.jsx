import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useRegion } from "@/lib/RegionContext";
import { formatPrice } from "@/lib/pricing";

export default function Cart() {
  const { items, updateQty, removeItem } = useCart();
  const { currency } = useRegion();
  const navigate = useNavigate();

  const subtotal = items.reduce((s, i) => s + i.customer_price * i.qty, 0);

  if (items.length === 0) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 rounded-lg bg-surface-card border border-border-hairline flex items-center justify-center mx-auto mb-5">
          <ShoppingBag className="w-7 h-7 text-text-muted" />
        </div>
        <h1 className="font-display font-bold text-2xl">Your cart is empty</h1>
        <p className="text-sm text-text-muted mt-2">Discover premium electronics and split the cost into installments.</p>
        <Link to="/category" className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-lg bg-noon text-noon-fg font-medium text-sm">
          Browse catalog <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1100px] mx-auto">
      <h1 className="font-display font-bold text-2xl md:text-3xl mb-6">Your Cart</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 bg-surface-card border border-border-hairline rounded-lg p-3">
              <Link to={`/product/${item.id}`} className="w-24 h-24 rounded-lg overflow-hidden bg-surface-secondary shrink-0">
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-text-muted">{item.brand}</div>
                <Link to={`/product/${item.id}`} className="text-sm font-medium hover:text-accent-cyan line-clamp-2">{item.name}</Link>
                <div className="font-display font-bold text-lg mt-1">{formatPrice(item.customer_price, currency)}</div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-border-hairline rounded-lg">
                    <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">−</button>
                    <span className="px-3 text-sm text-mono">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">+</button>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-text-muted hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="md:col-span-1">
          <div className="bg-surface-card border border-border-hairline rounded-lg p-5 sticky top-24">
            <h2 className="font-display font-semibold text-lg mb-4">Order summary</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span className="text-mono">{formatPrice(subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Shipping</span><span className="text-mono">Calculated at checkout</span></div>
              <div className="border-t border-border-hairline pt-2.5 flex justify-between font-semibold"><span>Total</span><span className="text-mono">{formatPrice(subtotal, currency)}</span></div>
            </div>
            <button
              onClick={() => navigate("/checkout")}
              className="w-full mt-5 py-3.5 rounded-lg bg-noon text-noon-fg font-semibold text-sm hover:opacity-90 transition"
            >
              Checkout
            </button>
            <Link to="/category" className="block text-center text-xs text-text-muted hover:text-accent-cyan mt-3">Continue shopping</Link>
          </div>
        </div>
      </div>
    </div>
  );
}