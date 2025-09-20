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
  edhrecUri?: string;
  partnerKind?: Commander["partnerKind"];
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
  // Fast lookup by ID and by (name|CI)
  const byId = new Map<string, Commander>();
  const byKey = new Map<string, Commander>();

  for (const c of existing) {
    byId.set(c.id, c);
    byKey.set(`${c.name}|${canonicalCI(c.colourIdentity)}`, c);
  }

  for (const row of dump.commanders) {
    const name = row.name?.trim();
    const ci = canonicalCI(row.colourIdentity);
    if (!name || !ci) continue;

    const key = `${name}|${ci}`;
    const current =
      (row.id && byId.get(row.id)) // prefer Scryfall UUID match
      ?? byKey.get(key);           // fall back to name+CI

    // Normalise dump fields we want to carry over
    const cat = {
      image: row.image ?? null,
      scryfall: row.scryfallUri ?? undefined,
      edhrecRank: row.edhrecRank ?? undefined,
      edhrecUri: row.edhrecUri ?? undefined,
      partnerKind: row.partnerKind ?? undefined,
      partnerWithNames: row.partnerWithNames ?? undefined,
    } as const;

    if (current) {
      // Patch the existing record with catalogue fields (don’t touch user fields like tags)
      const updated: Commander = {
        ...current,
        // keep user id/name/ci; update catalogue bits
        image: cat.image ?? current.image ?? null,
        scryfall: cat.scryfall ?? current.scryfall,
        edhrecRank: cat.edhrecRank ?? current.edhrecRank,
        edhrecUri: cat.edhrecUri ?? current.edhrecUri,
        partnerKind: cat.partnerKind ?? current.partnerKind,
        partnerWithNames: cat.partnerWithNames ?? current.partnerWithNames,
      };
      byId.set(updated.id, updated);
      byKey.set(key, updated);
    } else {
      // New commander
      const cmd: Commander = {
        id:
          row.id ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 10)),
        name,
        colourIdentity: ci,
        image: cat.image ?? null,
        scryfall: cat.scryfall,
        edhrecRank: cat.edhrecRank,
        edhrecUri: cat.edhrecUri,
        partnerKind: cat.partnerKind,
        partnerWithNames: cat.partnerWithNames,
        // optional user fields stay empty by default
        tags: (undefined as unknown as string[] | undefined), // or omit entirely if your type makes them optional
      };
      byId.set(cmd.id, cmd);
      byKey.set(key, cmd);
    }
  }

  // Return unique commanders (by id) in a stable order
  const uniqueById = new Map<string, Commander>();
  for (const c of byKey.values()) uniqueById.set(c.id, c);
  return [...uniqueById.values()].sort((a, b) => a.name.localeCompare(b.name));
}
