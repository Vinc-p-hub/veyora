// Search engine: synonyms, tokenization, fuzzy expansion, intent-aware ranking.
// Pure functions — shared by the searchProducts backend function and automated tests.

const SYNONYMS = [
  ["i phone", "iphone"],
  ["i-phone", "iphone"],
  ["i pod", "ipod"],
  ["mac book", "macbook"],
  ["mac book pro", "macbook pro"],
  ["mac book air", "macbook air"],
  ["air pods", "airpods"],
  ["air pod", "airpods"],
  ["i pad", "ipad"],
  ["playstation 5", "ps5"],
  ["play station", "playstation"],
  ["ps 5", "ps5"],
  ["galaxy s", "galaxy"],
  ["wh1000xm", "wh-1000xm"],
  ["wh 1000xm", "wh-1000xm"],
  ["wh1000", "wh-1000"],
  ["lab top", "laptop"],
  ["note book", "notebook"],
  ["tv 4k", "4k tv"],
].sort((a, b) => b[0].length - a[0].length);

export function normalizeQuery(q) {
  let s = String(q || "").toLowerCase().trim().replace(/\s+/g, " ");
  for (const [from, to] of SYNONYMS) {
    if (s.includes(from)) s = s.split(from).join(to);
  }
  return s;
}

export function tokenize(q) {
  return normalizeQuery(q).split(/[^a-z0-9]+/).filter((t) => t.length >= 1 && !["the", "a", "for", "with", "and"].includes(t));
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function buildLexicon(products) {
  const lex = new Set();
  for (const p of products) {
    tokenize(p.name || "").forEach((t) => t.length >= 3 && lex.add(t));
    tokenize(p.brand || "").forEach((t) => t.length >= 2 && lex.add(t));
    tokenize(p.category || "").forEach((t) => t.length >= 3 && lex.add(t));
    tokenize(p.model || "").forEach((t) => t.length >= 2 && lex.add(t));
  }
  return lex;
}

// Typo tolerance: expand query tokens against the catalog lexicon.
export function expandTokens(tokens, lexicon) {
  const out = [...tokens];
  const seen = new Set(tokens);
  for (const t of tokens) {
    if (t.length < 3 || lexicon.has(t)) continue;
    const maxDist = t.length >= 7 ? 2 : 1;
    let best = null;
    let bestDist = 5;
    for (const l of lexicon) {
      const d = levenshtein(t, l);
      // same-prefix typo tolerance: "headfon" -> "headphones" (distance 4, shared "head" prefix)
      const prefixOk =
        (d <= 3 && t.length >= 4 && l.slice(0, 3) === t.slice(0, 3)) ||
        (d <= 4 && t.length >= 6 && l.slice(0, 4) === t.slice(0, 4));
      if ((d <= maxDist || prefixOk) && d < bestDist) { bestDist = d; best = l; }
    }
    if (best && !seen.has(best)) { seen.add(best); out.push(best); }
  }
  return out;
}

function scoreProduct(p, qTokens) {
  if (!qTokens.length) return 0;
  const nameTokens = tokenize(p.name || "");
  const brandTokens = tokenize(p.brand || "");
  let score = 0;
  let matched = 0;
  for (const t of qTokens) {
    let s = 0;
    if (brandTokens.includes(t)) s = Math.max(s, 4);
    if (nameTokens.includes(t)) s = Math.max(s, 3);
    else if (nameTokens.some((n) => n.startsWith(t) && t.length >= 3)) s = Math.max(s, 2);
    if (String(p.category || "").toLowerCase().includes(t)) s = Math.max(s, 2);
    if (String(p.model || "").toLowerCase().includes(t)) s = Math.max(s, 3);
    if (s > 0) matched++;
    score += s;
  }
  if (score === 0) return 0;
  // all tokens matched = strong intent match
  const coverage = matched / qTokens.length;
  score = score * (0.5 + coverage * 0.5);
  // marketplace ranking signals — never insertion order alone
  score += ((p.premium_score || 0) / 100) * 3;
  score += ((p.rating || 4.5) / 5) * 1.5;
  if (p.stock_status === "IN_STOCK") score += 1;
  if (p.premium_status === "PREMIUM") score += 0.5;
  return score;
}

// Main entry: search a product list with fuzzy matching, facets and zero-result fallback.
export function searchCatalog(products, q, opts = {}) {
  const limit = opts.limit || 20;
  const rawTokens = tokenize(q);
  if (!rawTokens.length) {
    const popular = [...products].sort((a, b) => (b.premium_score || 0) - (a.premium_score || 0)).slice(0, limit);
    return { results: popular, brands: [], categories: [], corrected: null, fallback: [], normalizedQuery: "", expandedTokens: [] };
  }
  const lexicon = buildLexicon(products);
  const expanded = [...new Set(expandTokens(rawTokens, lexicon))];
  const normalizedQuery = normalizeQuery(q);

  const scored = products
    .map((p) => ({ p, s: scoreProduct(p, expanded) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const results = scored.slice(0, limit).map((x) => x.p);

  let corrected = null;
  if (!results.length && expanded.join(" ") !== rawTokens.join(" ")) {
    corrected = expanded.join(" ");
  }

  const brands = [...new Set(results.map((p) => p.brand).filter(Boolean))].slice(0, 6);
  const categories = [...new Set(results.map((p) => p.category).filter(Boolean))].slice(0, 6);

  const fallback = results.length
    ? []
    : [...products]
        .sort((a, b) => (b.premium_score || 0) - (a.premium_score || 0))
        .slice(0, opts.fallbackLimit || limit);

  return { results, brands, categories, corrected, fallback, normalizedQuery, expandedTokens: expanded };
}