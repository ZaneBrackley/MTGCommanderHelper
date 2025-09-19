#!/usr/bin/env node
// Node 18+ (global fetch). ESM.
// Speeds up Archidekt tag harvesting via concurrency, caching, and checkpoints.

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- Paths ----------
const INPUT_PATH = resolve(__dirname, "../public/commanders.json");
const OUTPUT_PATH = resolve(__dirname, "../public/commander-tags.json");
const CACHE_PATH = resolve(__dirname, "../data/tags-cache.json"); // persisted cache
const CHECKPOINT_EVERY = parseInt(
  process.env.TAGS_CHECKPOINT_EVERY ?? "50",
  10
);

// ---------- Tunables (env overrides) ----------
const ARCHIDEKT_BASE = "https://archidekt.com/api/decks/v3/";
const PAGE_SIZE = 50;
const PAGE_DELAY_MS = parseInt(process.env.TAGS_PAGE_DELAY_MS ?? "50", 10);
const DECK_SAMPLE_LIM = parseInt(process.env.TAGS_DECK_LIMIT ?? "200", 10); // per commander
const TOP_TAGS = parseInt(process.env.TAGS_TOP_N ?? "10", 10);
const MIN_TAG_COUNT = parseInt(process.env.TAGS_MIN_COUNT ?? "4", 10);
const CONCURRENCY = parseInt(process.env.TAGS_CONCURRENCY ?? "6", 10);
const MAX_COMMANDERS = process.env.TAGS_MAX_COMMANDERS
  ? parseInt(process.env.TAGS_MAX_COMMANDERS, 10)
  : Infinity;
const CACHE_TTL_DAYS = parseInt(process.env.TAGS_CACHE_TTL_DAYS ?? "30", 10);
const ONLY_MISSING =
  String(process.env.TAGS_ONLY_MISSING ?? "false").toLowerCase() === "true";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function nowISO() {
  return new Date().toISOString();
}
function daysAgo(ts) {
  return (Date.now() - new Date(ts).getTime()) / 86400000;
}

// Fold string: lower + strip diacritics + collapse spaces
function fold(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getTagText(tag) {
  if (!tag) return "";
  if (typeof tag === "string") return tag;
  if (typeof tag === "object") {
    // Try common keys Archidekt uses for tags on deck cards
    const v =
      tag.name ?? tag.label ?? tag.text ?? tag.title ?? tag.slug ?? tag.value;
    return typeof v === "string" ? v : "";
  }
  return "";
}

function normTag(t) {
  return String(t)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#/, ""); // strip a leading '#', if any
}

// ---------- tiny p-limit ----------
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const runNext = () => {
    if (active >= concurrency) return;
    const next = queue.shift();
    if (!next) return;
    active++;
    next
      .fn()
      .then(next.resolve, next.reject)
      .finally(() => {
        active--;
        runNext();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

async function safeReadJSON(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}
async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") || 1);
    console.warn(`[archidekt] 429 → waiting ${retry}s`);
    await sleep(retry * 1000);
    return getJSON(url);
  }
  if (!res.ok) {
    if (res.status === 404) return { count: 0, results: [], next: null };
    const text = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for ${url}${text ? ` — ${text.slice(0, 120)}` : ""}`
    );
  }
  return res.json();
}

function composeURL(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) u.searchParams.append(k, String(v));
  return u.toString();
}

// Paged v3 search by cardName (Commander); we filter to Commander decks client-side
async function* pagedSearchByName(name) {
  let url = composeURL(ARCHIDEKT_BASE, {
    page_size: PAGE_SIZE,
    orderBy: "-views",
    cardName: name,
  });
  while (url) {
    const data = await getJSON(url);
    const results = Array.isArray(data.results) ? data.results : [];
    yield results;
    url = data.next || null;
    if (url) await sleep(PAGE_DELAY_MS + Math.random() * 50); // tiny jitter
  }
}

function isCommanderDeck(d) {
  const fmt = (d.format ?? d.deckFormat ?? "").toString().toLowerCase();
  return fmt.includes("commander") || fmt === "3";
}

async function collectTagsFor(name, deckLimit) {
  const counts = new Map();
  let seen = 0;

  for await (const results of pagedSearchByName(name)) {
    for (const deck of results) {
      if (!isCommanderDeck(deck)) continue;
      const tags = Array.isArray(deck.tags) ? deck.tags : [];
      for (const raw of tags) {
        const key = normTag(getTagText(raw));
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      seen++;
      if (seen >= deckLimit) break;
    }
    if (seen >= deckLimit) break;
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const trimmed = sorted
    .filter(([, n]) => n >= MIN_TAG_COUNT)
    .slice(0, TOP_TAGS);
  return {
    tags: trimmed.map(([t]) => t),
    tagCounts: Object.fromEntries(trimmed),
    scanned: seen,
    updatedAt: nowISO(),
    source: "archidekt:v3",
  };
}

// ---------- Main ----------
async function main() {
  // Load catalogue
  const cat = await safeReadJSON(INPUT_PATH, null);
  if (!cat || !Array.isArray(cat.commanders))
    throw new Error(`No commanders found in ${INPUT_PATH}`);
  let commanders = cat.commanders.slice();

  // Process most relevant first (EDHREC rank ascending if available)
  commanders.sort((a, b) => {
    const ar = a.edhrecRank ?? Number.POSITIVE_INFINITY;
    const br = b.edhrecRank ?? Number.POSITIVE_INFINITY;
    return ar - br || String(a.name).localeCompare(String(b.name));
  });

  if (Number.isFinite(MAX_COMMANDERS))
    commanders = commanders.slice(0, MAX_COMMANDERS);

  // Load existing output + cache (incremental)
  const existing = await safeReadJSON(OUTPUT_PATH, { byKey: {}, byId: {} });
  const cache = await safeReadJSON(CACHE_PATH, { entries: {} });
  cache.entries ||= {}; // key → { tags, tagCounts, scanned, updatedAt }

  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let changed = 0;

  // Ensure output dir
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await mkdir(dirname(CACHE_PATH), { recursive: true });

  console.log(
    `[tags] commanders=${commanders.length}  concurrency=${CONCURRENCY}  sample=${DECK_SAMPLE_LIM}`
  );

  const tasks = commanders.map((rec, idx) =>
    limit(async () => {
      const name = String(rec.name ?? "").trim();
      const ci = String(rec.colourIdentity ?? "").trim();
      if (!name) return;

      const key = `${name}|${ci}`;
      // 1) reuse existing (output) if ONLY_MISSING and present
      if (ONLY_MISSING && existing.byKey?.[key]?.tags?.length) return;

      // 2) cache check (TTL)
      const cached = cache.entries[key];
      if (
        cached &&
        daysAgo(cached.updatedAt) < CACHE_TTL_DAYS &&
        (cached.tags?.length ?? 0) > 0
      ) {
        existing.byKey[key] = cached;
        return;
      }

      // 3) collect fresh
      process.stdout.write(
        `[tags] ${idx + 1}/${commanders.length} ${name} (${ci || "?"}) … `
      );
      try {
        const out = await collectTagsFor(name, DECK_SAMPLE_LIM);
        existing.byKey[key] = out;
        cache.entries[key] = out;
        changed++;
        process.stdout.write(`${out.tags.slice(0, 3).join(", ")}\n`);
      } catch (e) {
        process.stdout.write(`fail: ${(e && e.message) || String(e)}\n`);
      }

      processed++;

      // checkpoint occasionally
      if (processed % CHECKPOINT_EVERY === 0) {
        await writeFile(
          OUTPUT_PATH,
          JSON.stringify(
            { byKey: existing.byKey, byId: existing.byId ?? {} },
            null,
            2
          ),
          "utf8"
        );
        await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
        console.log(`[tags] checkpoint @ ${processed} (changed=${changed})`);
      }
    })
  );

  await Promise.all(tasks);

  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      { byKey: existing.byKey, byId: existing.byId ?? {} },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");

  console.log(`[tags] done. updated ${changed} entries → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("[tags] failed:", err);
  process.exitCode = 1;
});
