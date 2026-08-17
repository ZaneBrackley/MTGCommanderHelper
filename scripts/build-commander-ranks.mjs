#!/usr/bin/env node
// Scrapes EDHREC's "Top Commanders" ranking (edhrec.com/commanders).
//
// Page 1 (~100 commanders) is server-rendered directly into the page HTML
// inside a <script id="__NEXT_DATA__"> tag — there's no separate file for it.
//
// Page 2+ (from clicking "Load More") is a real JSON endpoint, confirmed via
// DevTools:
//   https://json-cloudflare.edhrec.com/pages/commanders/year-past2years-{N}.json
//   where N=1 is page 2, N=2 is page 3, etc.
//
// Both are unofficial/undocumented and may change without notice.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/commander-ranks.json");
const DEBUG_PATH = resolve(__dirname, "../data/commander-ranks-debug.json");
const HTML_PAGE_URL = "https://edhrec.com/commanders";
const JSON_BASE = "https://json-cloudflare.edhrec.com/pages/commanders/year-past2years";
const MAX_PAGES = 50; // ~100/page → covers well past 3,411 commanders

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Origin: "https://edhrec.com",
  Referer: "https://edhrec.com/",
};

function fold(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Recursively find every "cardviews" array anywhere in a response, since the
// exact nesting path isn't confirmed/documented and differs between the HTML
// __NEXT_DATA__ payload and the plain JSON pages.
function findCardviews(node, results = []) {
  if (!node || typeof node !== "object") return results;
  if (Array.isArray(node.cardviews)) results.push(...node.cardviews);
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") findCardviews(v, results);
  }
  return results;
}

function collectFromCardviews(cardviews, seen) {
  const before = seen.size;
  for (const cv of cardviews) {
    const name = cv?.name;
    const decks = cv?.num_decks ?? cv?.numDecks ?? cv?.decks;
    if (name && typeof decks === "number") {
      seen.set(fold(name), decks);
    }
  }
  return seen.size - before;
}

async function fetchPage1() {
  console.log(`[ranks] Fetching page 1 (${HTML_PAGE_URL})…`);
  const res = await fetch(HTML_PAGE_URL, {
    headers: { ...BROWSER_HEADERS, Accept: "text/html" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${HTML_PAGE_URL}\n${body.slice(0, 200)}`);
  }

  const html = await res.text();
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error("Could not find __NEXT_DATA__ script tag in page HTML");
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);

  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

async function fetchJsonPage(n) {
  // n=1 -> page 2, n=2 -> page 3, ...
  const url = `${JSON_BASE}-${n}.json`;
  console.log(`[ranks] Fetching page ${n + 1} (${url})…`);
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json", ...BROWSER_HEADERS } });
  } catch (err) {
    console.error(`[ranks] Network error fetching ${url}:`, err.message);
    return null;
  }
  if (!res.ok) {
    if (res.status !== 403 && res.status !== 404) {
      const body = await res.text().catch(() => "");
      console.error(`[ranks] HTTP ${res.status} for ${url}\n${body.slice(0, 200)}`);
    } else {
      console.log(`[ranks] Page ${n + 1}: HTTP ${res.status} — assuming end of list.`);
    }
    return null;
  }
  return res.json();
}

async function main() {
  const seen = new Map(); // folded name -> num_decks

  const page1 = await fetchPage1();
  await mkdir(dirname(DEBUG_PATH), { recursive: true });
  await writeFile(DEBUG_PATH, JSON.stringify(page1, null, 2), "utf8");
  console.log(`[ranks] Saved raw page 1 response → ${DEBUG_PATH} (for debugging)`);

  const page1Cardviews = findCardviews(page1);
  const added1 = collectFromCardviews(page1Cardviews, seen);
  console.log(`[ranks] Page 1: ${page1Cardviews.length} cardviews, ${added1} new, ${seen.size} total`);

  if (seen.size === 0) {
    console.warn(`[ranks] Page 1 gave 0 commanders — check ${DEBUG_PATH} for the real shape.`);
    return;
  }

  for (let n = 1; n <= MAX_PAGES; n++) {
    const data = await fetchJsonPage(n);
    if (!data) break;

    const cardviews = findCardviews(data);
    if (cardviews.length === 0) {
      console.log(`[ranks] Page ${n + 1} had no cardviews — stopping.`);
      break;
    }

    const added = collectFromCardviews(cardviews, seen);
    console.log(`[ranks] Page ${n + 1}: ${cardviews.length} cardviews, ${added} new, ${seen.size} total`);

    if (added === 0) {
      console.log(`[ranks] Page ${n + 1} added nothing new — stopping.`);
      break;
    }

    await new Promise((r) => setTimeout(r, 150)); // be polite
  }

  const ranked = [...seen.entries()].sort((a, b) => b[1] - a[1]);
  const byKey = {};
  ranked.forEach(([foldedName, numDecks], idx) => {
    byKey[foldedName] = { commanderRank: idx + 1, commanderDecks: numDecks };
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify({ byKey }, null, 2), "utf8");
  console.log(`[ranks] Wrote ${ranked.length} commander ranks → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[ranks] Failed:", err.message);
  process.exitCode = 1;
});