// scripts/build-commanders.mjs
import { writeFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename); // (unused; safe to remove)

// ---- Config ---------------------------------------------------------------
const OUTPUT_URL = new URL("../public/commanders.json", import.meta.url);
const OUTPUT_PATH = fileURLToPath(OUTPUT_URL);
const SCRY_SEARCH = "https://api.scryfall.com/cards/search";
const PIPS = ["W", "U", "B", "R", "G"];
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const QUERY = "is:commander legal:commander game:paper";
// --------------------------------------------------------------------------

function canonicalCI(ci) {
  // Accept array from Scryfall or a string
  const arr = Array.isArray(ci)
    ? ci.map((s) => String(s).toUpperCase())
    : (ci || "")
        .toUpperCase()
        .replace(/[^CWUBRG]/g, "")
        .split("");

  // If any coloured pips exist, sort/display as W U B R G
  const coloured = arr.filter((c) => PIPS.includes(c));
  if (coloured.length) {
    return coloured.sort((a, b) => PIPS.indexOf(a) - PIPS.indexOf(b)).join("");
  }

  // Scryfall uses [] for colourless; canonicalise to "C"
  return "C";
}

function pickImage(card) {
  // Prefer front face normal image; fall back gracefully
  return (
    card?.image_uris?.normal ??
    card?.card_faces?.[0]?.image_uris?.normal ??
    card?.image_uris?.large ??
    card?.card_faces?.[0]?.image_uris?.large ??
    null
  );
}

function detectPartner(card) {
  const keywords = Array.isArray(card.keywords) ? card.keywords : [];
  const text = String(card.oracle_text || "");

  // Backgrounds
  const isBackgroundType = String(card.type_line || "").includes("Background");
  if (isBackgroundType) return { partnerKind: "background" };

  // Creatures that can choose a background
  if (/Choose a Background/i.test(text))
    return { partnerKind: "chooseBackground" };

  // Friends forever
  if (keywords.includes("Friends forever"))
    return { partnerKind: "friendsForever" };

  // Partner with <Name>
  const m = text.match(/partner with ([^\n(]+)/i);
  if (m) {
    const raw = m[1].trim();
    // Only split on “ and ” if there are truly two different partners listed
    const names = /\sand\s/i.test(raw)
      ? raw.split(/\s+and\s+/i).map((s) => s.trim())
      : [raw];
    return { partnerKind: "partnerWith", partnerWithNames: names };
  }

  // Generic Partner (but avoid double-counting the above)
  if (keywords.includes("Partner")) return { partnerKind: "partner" };

  return { partnerKind: "none" };
}

function mapCard(card) {
  const ciArray = Array.isArray(card.color_identity) ? card.color_identity : [];
  const ci = canonicalCI(ciArray.join(""));
  const partner = detectPartner(card);
  return {
    id: card.id,
    name: card.name.trim(),
    colourIdentity: ci,
    image: pickImage(card),
    scryfallUri: card.scryfall_uri,
    edhrecRank: card.edhrec_rank ?? null,
    ...partner,
  };
}

async function fetchAll() {
  let url = `${SCRY_SEARCH}?q=${encodeURIComponent(
    QUERY
  )}&unique=cards&order=edhrec`;
  const seen = new Set(); // de-dupe by name|CI (canonical)
  const out = [];

  let page = 1;
  while (url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") || 1);
      console.warn(`[scryfall] Rate limited. Waiting ${retry}s…`);
      await new Promise((r) => setTimeout(r, retry * 1000));
      continue; // retry same URL
    }
    if (!res.ok) {
      throw new Error(`Scryfall error ${res.status} on ${url}`);
    }
    const data = await res.json(); // { object, data, has_more, next_page }
    if (!Array.isArray(data.data)) {
      throw new Error("Unexpected Scryfall response shape.");
    }

    // Map and accumulate
    for (const card of data.data) {
      const rec = mapCard(card);
      if (!rec.name || !rec.colourIdentity) continue; // skip oddballs
      const key = `${rec.name}|${rec.colourIdentity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(rec);
    }

    console.log(
      `[scryfall] Page ${page} · fetched ${data.data.length} · total unique ${out.length}`
    );
    url = data.has_more ? data.next_page : "";
    page += 1;

    // Be gentle to the API (≤10 req/s recommended)
    await new Promise((r) => setTimeout(r, 120)); // ~8 req/s
  }

  // Prefer better EDHREC rank (lower number), then name
  out.sort((a, b) => {
    const ar = a.edhrecRank ?? 999999;
    const br = b.edhrecRank ?? 999999;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });

  return out;
}

async function useCacheIfFresh() {
  try {
    const s = await stat(OUTPUT_PATH);
    if (Date.now() - s.mtimeMs < MAX_AGE_MS) {
      console.log(`[build] Using cached ${OUTPUT_PATH} (fresh).`);
      return true;
    }
  } catch {}
  return false;
}

async function main() {
  try {
    console.log("[build] Starting commander import from Scryfall…");
    if (await useCacheIfFresh()) return;
    const all = await fetchAll();

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });

    const payload = {
      source: `${SCRY_SEARCH}?q=${encodeURIComponent(
        QUERY
      )}&unique=cards&order=edhrec`,
      generatedAt: new Date().toISOString(),
      count: all.length,
      commanders: all,
    };

    await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
    console.log(`[build] Wrote ${all.length} commanders → ${OUTPUT_PATH}`);
    console.log(
      `[build] Remember Scryfall attribution: https://scryfall.com/docs/api`
    );
  } catch (err) {
    console.error("[build] Failed:", err);
    process.exitCode = 1;
  }
}

main();
