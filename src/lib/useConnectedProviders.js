import { useEffect, useState } from "react";
import { api } from "@/api/client";

// The payment methods the storefront may offer — resolved server-side from the
// providers switched on in the back office. Fetched once per session and shared
// by the checkout, the payment-methods page and the footer.
let cache = null;
let pending = null;

export function useConnectedProviders() {
  const [providers, setProviders] = useState(cache || []);

  useEffect(() => {
    if (cache) {
      setProviders(cache);
      return;
    }
    if (!pending) {
      pending = api.functions
        .invoke("pspPublicProviders", {})
        .then((res) => {
          cache = res.data?.providers || [];
          return cache;
        })
        // A failed lookup is never cached, so the next page retries instead of
        // showing a storefront without payment methods for the whole session.
        .catch(() => {
          pending = null;
          return null;
        });
    }
    let alive = true;
    pending.then((list) => {
      if (alive && list) setProviders(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  return providers;
}

// Called after the back office connects or disconnects a provider so the
// storefront, checkout and footer pick the change up immediately.
export function invalidateConnectedProviders() {
  cache = null;
  pending = null;
}