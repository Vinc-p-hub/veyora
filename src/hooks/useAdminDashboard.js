import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

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
        base44.entities.Order.list("-created_date", 500),
        base44.entities.Product.list("-created_date", 500),
        base44.entities.CrawlerSource.list("-created_date", 50),
        base44.entities.CrawlerJob.list("-updated_date", 300),
        base44.entities.PspWebhookEvent.list("-created_date", 50).catch(() => []),
        base44.entities.CurrencyRate.list(null, 200).catch(() => []),
        base44.functions.invoke("pspCredentials", {}).catch(() => null),
      ]);
      setData({
        orders,
        products,
        sources,
        jobs,
        events,
        rates,
        providers: providerRes?.data?.providers || [],
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
      base44.entities.Order.subscribe(schedule),
      base44.entities.Product.subscribe(schedule),
      base44.entities.CrawlerJob.subscribe(schedule),
      base44.entities.CrawlerSource.subscribe(schedule),
      base44.entities.PspWebhookEvent.subscribe(schedule),
    ];
    return () => {
      clearTimeout(debounce.current);
      unsubs.forEach((unsub) => typeof unsub === "function" && unsub());
    };
  }, [load]);

  return { data, loading, lastUpdate, reload: () => load(true) };
}