import { useEffect, useState } from "react";
import { api } from "@/api/client";

// Configurable storefront copy (Marketplace notice etc.) — defaults live in
// code, the Super Admin overrides them as SiteSetting records.
let settingsPromise = null;

function loadSettings() {
  if (!settingsPromise) {
    settingsPromise = api.entities.SiteSetting.list(null, 100).catch(() => []);
  }
  return settingsPromise;
}

export function useSiteText() {
  const [map, setMap] = useState({});

  useEffect(() => {
    let live = true;
    loadSettings().then((rows) => {
      if (!live) return;
      setMap(Object.fromEntries((rows || []).map((r) => [r.key, r.value])));
    });
    return () => {
      live = false;
    };
  }, []);

  return (key, fallback = "") => (map[key] && map[key].trim() ? map[key] : fallback);
}