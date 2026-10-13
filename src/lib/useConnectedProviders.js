import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";

// The payment providers switched on in the back office, resolved server-side.
// Short-lived cache (an empty list is re-checked quickly) so a connection made in the admin
// shows up without a reload, and a failed lookup is reported instead of looking like "no PSP".
let cache = null;
let cacheAt = 0;
let pending = null;

const fresh = () => cache && Date.now() - cacheAt < (cache.length ? 60_000 : 10_000);

function fetchProviders() {
  if (!pending) {
    pending = api.functions
      .invoke("payments", { action: "providers" })
      .then((res) => {
        cache = res.data?.providers || [];
        cacheAt = Date.now();
        return cache;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

// status: "loading" | "ready" | "error"
export function useConnectedProvidersState() {
  const [state, setState] = useState(() => (fresh() ? { providers: cache, status: "ready" } : { providers: [], status: "loading" }));

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: "loading" }));
    fetchProviders()
      .then((providers) => setState({ providers, status: "ready" }))
      .catch(() => setState({ providers: [], status: "error" }));
  }, []);

  useEffect(() => {
    if (fresh()) {
      setState({ providers: cache, status: "ready" });
      return;
    }
    load();
  }, [load]);

  return { ...state, reload: load };
}

export function useConnectedProviders() {
  return useConnectedProvidersState().providers;
}

// Called after the back office connects or disconnects a provider so the
// storefront, checkout and footer pick the change up immediately.
export function invalidateConnectedProviders() {
  cache = null;
  cacheAt = 0;
  pending = null;
}
