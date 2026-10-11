import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/client";

// Loads the dashboard dataset once, then keeps it live: any change on the
// orders, catalog, crawler queue/sources or PSP webhooks schedules a reload
// (debounced, so a burst of events triggers a single refresh).
export default function useAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const debounce = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [orders, products, sources, jobs, events, rates, providerRes] = await Promise.all([
        api.entities.Order.list("-created_date", 500),
        api.entities.Product.list("-created_date", 500),
        api.entities.CrawlerSource.list("-created_date", 50),
        api.entities.CrawlerJob.list("-updated_date", 300),
        api.entities.PspWebhookEvent.list("-created_date", 50).catch(() => []),
        api.entities.CurrencyRate.list(null, 200).catch(() => []),
        api.functions.invoke("paypal", { action: "providers" }).catch(() => null),
      ]);
      setData({
        orders,
        products,
        sources,
        jobs,
        events,
        rates,
        providers: (providerRes?.data?.providers || []).map((p) => ({ ...p, configured: true, enabled: true })),
      });
      setLastUpdate(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const schedule = () => {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(() => load(true), 1200);
    };
    const unsubs = [
      api.entities.Order.subscribe(schedule),
      api.entities.Product.subscribe(schedule),
      api.entities.CrawlerJob.subscribe(schedule),
      api.entities.CrawlerSource.subscribe(schedule),
      api.entities.PspWebhookEvent.subscribe(schedule),
    ];
    return () => {
      clearTimeout(debounce.current);
      unsubs.forEach((unsub) => typeof unsub === "function" && unsub());
    };
  }, [load]);

  return { data, loading, lastUpdate, reload: () => load(true) };
}