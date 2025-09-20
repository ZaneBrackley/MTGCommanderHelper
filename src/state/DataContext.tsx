import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  SaveData,
  Commander,
  ChallengeChoice,
  PartnerKind,
} from "../lib/types";
import { canonicalCI, unionCI } from "../lib/identity";
import {
  loadCommandersJSON,
  mergeDumpIntoCommanders,
  loadCommanderTags,
} from "../services/loadCommanders";
import type { TagInfo } from "../services/loadCommanders";

// ---------------- Context types ----------------
type Ctx = {
  data: SaveData;
  addCommander: (c: Commander) => void;
  deleteCommander: (id: string) => void;
  assignChallenge: (ci: string, choice: ChallengeChoice) => void;
  replaceCommanders: (next: Commander[]) => void;
  clearChallenge: (ci: string) => void;
};

const KEY = "mtg-commander-picker:v1";
const seed: SaveData = { commanders: [], challenge: {} };

// eslint-disable-next-line react-refresh/only-export-components
export const DataCtx = createContext<Ctx | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

// ---------------- Small helpers ----------------
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toCommanderFromStored(u: unknown): Commander {
  const r = isRecord(u) ? u : {};
  const id =
    typeof r.id === "string"
      ? r.id
      : (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 10));

  const name = typeof r.name === "string" ? r.name : "";
  const colourIdentity = canonicalCI(typeof r.colourIdentity === "string" ? r.colourIdentity : "");

  const scryfall    = typeof r.scryfall    === "string" ? r.scryfall    : undefined;
  const image       = typeof r.image       === "string" ? r.image       : null;
  const edhrecUri   = typeof r.edhrecUri   === "string" ? r.edhrecUri   : undefined;
  const edhrecRank  = typeof r.edhrecRank  === "number" ? r.edhrecRank  : undefined;

  const partnerKind: PartnerKind =
    typeof r.partnerKind === "string" ? (r.partnerKind as PartnerKind) : "none";

  const partnerWithNames = Array.isArray(r.partnerWithNames)
    ? (r.partnerWithNames as unknown[]).map(String)
    : undefined;

  const tags = Array.isArray(r.tags) ? (r.tags as unknown[]).map(String) : undefined;

  let tagCounts: Record<string, number> | undefined;
  if (isRecord(r.tagCounts)) {
    const entries = Object.entries(r.tagCounts).map(([k, v]) => [k, Number(v)]);
    tagCounts = Object.fromEntries(entries.filter(([, n]) => Number.isFinite(n))) as Record<string, number>;
  }

  return {
    id,
    name,
    colourIdentity,
    ...(scryfall     ? { scryfall }     : {}),
    ...(image !== null ? { image }      : { image: null }), // keep null explicit so UI knows there’s no image
    ...(edhrecUri    ? { edhrecUri }    : {}),
    ...(typeof edhrecRank === "number" ? { edhrecRank } : {}),
    ...(partnerKind !== "none" ? { partnerKind } : {}),
    ...(partnerWithNames && partnerWithNames.length ? { partnerWithNames } : {}),
    ...(tags && tags.length ? { tags } : {}),
    ...(tagCounts ? { tagCounts } : {}),
  };
}

function mergeTagsInto(
  list: Commander[],
  maps: { byId: Record<string, TagInfo>; byKey: Record<string, TagInfo> }
): Commander[] {
  if (!list.length) return list;
  return list.map((c) => {
    // Prefer id match
    const byId = maps.byId[c.id];
    if (byId) {
      return {
        ...c,
        ...(byId.tags ? { tags: byId.tags } : {}),
        ...(byId.tagCounts ? { tagCounts: byId.tagCounts } : {}),
      };
    }
    // Fallback: name|canonicalCI
    const key = `${c.name}|${canonicalCI(c.colourIdentity)}`;
    const byKey = maps.byKey[key];
    if (byKey) {
      return {
        ...c,
        ...(byKey.tags ? { tags: byKey.tags } : {}),
        ...(byKey.tagCounts ? { tagCounts: byKey.tagCounts } : {}),
      };
    }
    return c;
  });
}

// ---------------- Provider ----------------
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SaveData>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return seed;
      const parsed = JSON.parse(raw) as unknown;

      const obj = isRecord(parsed) ? parsed : {};
      const commanders: Commander[] = Array.isArray(obj.commanders)
        ? obj.commanders.map(toCommanderFromStored)
        : [];

      // migrate challenge → Record<string, ChallengeChoice>
      const legacy = isRecord(obj.challenge) ? obj.challenge : {};
      const challenge: Record<string, ChallengeChoice> = {};
      for (const [k, v] of Object.entries(legacy)) {
        const key = canonicalCI(k);
        if (isRecord(v) && typeof v.primaryId === "string") {
          challenge[key] = {
            primaryId: v.primaryId as string,
            ...(typeof v.partnerId === "string"
              ? { partnerId: v.partnerId as string }
              : {}),
          };
        } else if (typeof v === "string") {
          challenge[key] = { primaryId: v };
        }
      }

      return { commanders, challenge };
    } catch {
      return seed;
    }
  });

  // Persist on change
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

  // Boot: merge commanders.json and commander-tags.json once
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    (async () => {
      try {
        const dump = await loadCommandersJSON();
        let merged = mergeDumpIntoCommanders(dump, data.commanders);

        try {
          const tags = await loadCommanderTags();
          merged = mergeTagsInto(merged, tags);
        } catch (e) {
          // Non-fatal
          console.warn("Tags load skipped:", e);
        }

        setData((d) => ({ ...d, commanders: merged }));
      } catch (err) {
        console.warn("Auto-import failed:", err);
      }
    })();
  }, [data.commanders]);

  const api = useMemo<Ctx>(
    () => ({
      data,
      addCommander: (c: Commander) =>
        setData((d) => ({ ...d, commanders: [...d.commanders, c] })),
      deleteCommander: (id: string) =>
        setData((d) => ({
          ...d,
          commanders: d.commanders.filter((c) => c.id !== id),
        })),
      // Accept a full pair choice, and write under the union colour identity
      assignChallenge: (ci: string, choice: ChallengeChoice) =>
        setData((d) => {
          const primary = d.commanders.find((x) => x.id === choice.primaryId);
          const partner = choice.partnerId
            ? d.commanders.find((x) => x.id === choice.partnerId)
            : undefined;
          const combinedCI = unionCI(
            primary?.colourIdentity ?? "",
            partner?.colourIdentity
          );
          return {
            ...d,
            challenge: {
              ...d.challenge,
              [combinedCI || canonicalCI(ci)]: choice,
            },
          };
        }),
      replaceCommanders: (next: Commander[]) =>
        setData((d) => ({ ...d, commanders: next })),
      clearChallenge: (ci: string) =>
        setData((d) => {
          const key = canonicalCI(ci);
          const next = { ...d.challenge };
          delete next[key];
          return { ...d, challenge: next };
        }),
    }),
    [data]
  );

  return <DataCtx.Provider value={api}>{children}</DataCtx.Provider>;
}
