// Loads a third-party script once and resolves when it is ready.
const cache = {};
export function loadScript(src, globalName) {
  if (cache[src]) return cache[src];
  cache[src] = new Promise((resolve, reject) => {
    if (globalName && window[globalName]) return resolve(window[globalName]);
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => (globalName ? (window[globalName] ? resolve(window[globalName]) : reject(new Error("Script loaded but unavailable"))) : resolve(true));
    s.onerror = () => { delete cache[src]; reject(new Error("Could not load the payment form")); };
    document.head.appendChild(s);
  });
  return cache[src];
}
