// src/services/loadCommanders.ts
import { canonicalCI } from "../lib/identity";
import type { Commander } from "../lib/types";

export type CommanderRow = {
  id: string;
  name: string;
  colourIdentity: string;
  scryfallUri?: string;
  image?: string | null;
  edhrecRank?: number | null;
  partnerKind?:
    | "none"
    | "partner"
    | "partnerWith"
    | "friendsForever"
    | "chooseBackground"
    | "background";
  partnerWithNames?: string[];
};

export type CommanderDump = {
  source: string;
  generatedAt: string;
  count: number;
  commanders: CommanderRow[];
};

export type TagInfo = { tags?: string[]; tagCounts?: Record<string, number> };
export type TagsFile =
  | { byId?: Record<string, TagInfo>; byKey?: Record<string, TagInfo> }
  | Record<string, TagInfo>; // flat

export async function loadCommandersJSON(): Promise<CommanderDump> {
  // Works on / (dev) and on /your-repo/ (GitHub Pages)
  const url = `${import.meta.env.BASE_URL}commanders.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load commanders.json: ${res.status}`);
  return res.json();
}

export async function loadCommanderTags(): Promise<{
  byId: Record<string, TagInfo>;
  byKey: Record<string, TagInfo>;
}> {
  const url = `${import.meta.env.BASE_URL}commander-tags.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    // No tags file is fine; return empty maps
    return { byId: {}, byKey: {} };
  }
  const data = (await res.json()) as TagsFile;

  const byId: Record<string, TagInfo> = {};
  const byKey: Record<string, TagInfo> = {};

  // Normalise to maps
  if ("byId" in data || "byKey" in data) {
    Object.assign(byId, data.byId ?? {});
    Object.assign(byKey, data.byKey ?? {});
  } else {
    // flat map: try to guess if keys look like UUIDs or name|CI
    for (const [k, v] of Object.entries(data)) {
      if (/^[0-9a-f-]{36}$/i.test(k)) byId[k] = v;
      else byKey[k] = v;
    }
  }

  return { byId, byKey };
}

export function mergeDumpIntoCommanders(
  dump: CommanderDump,
  existing: Commander[]
): Commander[] {
  const byKey = new Map<string, Commander>();
  for (const c of existing) {
    byKey.set(`${c.name}|${c.colourIdentity}`, c);
  }

  for (const row of dump.commanders) {
    const name = row.name.trim();
    const ci = canonicalCI(row.colourIdentity);
    if (!name || !ci) continue;

    const key = `${name}|${ci}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      id:
        row.id ||
        (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)),
      name,
      colourIdentity: ci,
      scryfall: row.scryfallUri,
      image: row.image ?? null,
      ...(row.partnerKind ? { partnerKind: row.partnerKind } : {}),
      ...(Array.isArray(row.partnerWithNames)
        ? { partnerWithNames: row.partnerWithNames }
        : {}),
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
