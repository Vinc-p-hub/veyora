import { DOCS } from "../../src/lib/legalContent.js";
import { legalPage, render } from "./ssr.js";

// Server-render a policy page from the exact content the SPA displays (single source of truth).
export const legalRoute = (key) => async (context) => {
  const doc = DOCS[key];
  if (!doc) return context.next();
  const origin = new URL(context.request.url).origin;
  return render(context, legalPage(key, doc, origin));
};
