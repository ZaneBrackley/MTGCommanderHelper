import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "../state/DataContext";
import { COLOUR_PIPS, COLOURS_WITH_C, unionCI } from "../lib/identity";
import type { Commander, ChallengeChoice } from "../lib/types";
import CardThumb from "../components/CardThumb";
import { fold } from "../lib/text";
import {
  loadCommandersJSON,
  mergeDumpIntoCommanders,
} from "../services/loadCommanders";

// Tiny helpers
function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function normal(s: string) {
  return fold(String(s));
}

function findDirectPartner(
  base: Commander,
  all: Commander[]
): Commander | undefined {
  if ((base.partnerKind ?? "none") !== "partnerWith") return undefined;
  const list = base.partnerWithNames ?? [];
  if (list.length === 0) return undefined;

  // If dump already has a single full name, match exactly after folding.
  if (list.length === 1) {
    const target = normal(list[0]);
    return all.find((c) => normal(c.name) === target);
  }

  // Many dumps split the name into tokens. Build the expected full name:
  // ["Zndrsplt","Eye of Wisdom"] -> "Zndrsplt, Eye of Wisdom"
  const expected = normal(list.join(", "));
  const candidate =
    all.find((c) => normal(c.name) === expected) ||
    // fallback: all tokens must appear in the name
    all.find((c) => {
      const tn = normal(c.name);
      return list.map(normal).every((t) => tn.includes(t));
    });

  return candidate && candidate.id !== base.id ? candidate : undefined;
}

function ResultCard({
  base,
  all,
  onAssign,
}: {
  base: Commander;
  all: Commander[];
  onAssign: (ci: string, choice: ChallengeChoice) => void;
}) {
  const partner = findDirectPartner(base, all);
  const [showPartner, setShowPartner] = useState(false);

  // Which card are we showing right now?
  const current = showPartner && partner ? partner : base;

  // Build the right Assign action
  const handleAssign = () => {
    if (partner) {
      // Pair-only: always assign as the union colour identity
      const pairCI = unionCI(base.colourIdentity, partner.colourIdentity);
      const primary = current; // whichever is currently shown
      const partnerId = current.id === base.id ? partner.id : base.id;
      onAssign(pairCI, { primaryId: primary.id, partnerId });
      return;
    }
    // Non-direct-partner cards: assign solo (you can keep your optional partner flow if you have one)
    onAssign(current.colourIdentity, { primaryId: current.id });
  };

  const flipBtn = partner ? (
    <button
      onClick={() => setShowPartner((v) => !v)}
      className="px-2 py-1 rounded border border-neutral-700 text-xs hover:border-neutral-500"
      title={`Show ${showPartner ? base.name : partner.name}`}
    >
      Flip to {showPartner ? base.name : partner.name}
    </button>
  ) : null;

  return (
    <li className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
      <CardThumb
        src={current.image}
        alt={`${current.name} card art`}
        href={current.scryfall}
      />

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{current.name}</h3>
          <span className="text-xs border border-neutral-700 px-2 py-0.5 rounded">
            {current.colourIdentity}
          </span>
        </div>
        {flipBtn}
      </div>

      {(current.tags?.length ?? 0) > 0 && (
        <p className="text-xs text-neutral-400">
          {current.tags!.slice(0, 8).join(" · ")}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAssign}
          className="px-3 py-1.5 rounded border border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
        >
          {partner
            ? `Assign pair to ${unionCI(
                base.colourIdentity,
                partner.colourIdentity
              )}`
            : `Assign to ${current.colourIdentity}`}
        </button>
      </div>
    </li>
  );
}

export default function SearchPage() {
  const { data, assignChallenge, replaceCommanders } = useData();

  // Filters
  const [q, setQ] = useState("");
  const [ci, setCi] = useState<
    Record<"W" | "U" | "B" | "R" | "G" | "C", boolean>
  >({
    W: false,
    U: false,
    B: false,
    R: false,
    G: false,
    C: false,
  });
  const activeCI = ci.C ? "C" : COLOUR_PIPS.filter((c) => ci[c]).join("");

  // Tag filter
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // folded tags
  const [tagQ, setTagQ] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);

  // Build a tag index from current data (folded key → { label, count })
  const tagIndex = useMemo(() => {
    // foldedKey -> { label, count }
    const map = new Map<string, { label: string; count: number }>();

    for (const c of data.commanders) {
      // Collect unique raw tag labels per commander from both sources
      const unique = new Set<string>();
      for (const raw of c.tags ?? []) unique.add(raw);
      for (const raw of Object.keys(c.tagCounts ?? {})) unique.add(raw);

      for (const raw of unique) {
        const key = fold(raw);
        const increment =
          c.tagCounts && typeof c.tagCounts[raw] === "number"
            ? c.tagCounts[raw]!
            : 1; // fall back to +1 if no per-tag count provided

        const prev = map.get(key);
        if (prev)
          map.set(key, { label: prev.label, count: prev.count + increment });
        else map.set(key, { label: raw, count: increment });
      }
    }
    return map;
  }, [data.commanders]);

  const allTags = useMemo(
    () => [...tagIndex.entries()].sort((a, b) => b[1].count - a[1].count),
    [tagIndex]
  );

  const TAG_LIMIT = 36;
  const filteredTags = useMemo(() => {
    const q = fold(tagQ);
    const base = q
      ? allTags.filter(([, info]) => fold(info.label).includes(q))
      : allTags;
    return showAllTags ? base : base.slice(0, TAG_LIMIT);
  }, [allTags, tagQ, showAllTags]);

  const toggleTag = useCallback((foldedKey: string) => {
    setSelectedTags((s) =>
      s.includes(foldedKey)
        ? s.filter((t) => t !== foldedKey)
        : [...s, foldedKey]
    );
  }, []);

  const clearTags = useCallback(() => setSelectedTags([]), []);

  // Import UI state
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");
  const [autoTried, setAutoTried] = useState(false); // guard auto-import

  const results = useMemo(() => {
    const ql = fold(q);
    return data.commanders
      .filter((c) => !ql || fold(c.name).includes(ql))
      .filter((c) => !activeCI || c.colourIdentity === activeCI)
      .filter((c) => {
        if (selectedTags.length === 0) return true;
        const tags = (c.tags ?? []).map(fold);
        if (tags.length === 0) return false;
        // “Any” match behaviour
        return selectedTags.some((t) => tags.includes(t));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.commanders, q, activeCI, selectedTags]);

  // Stable import function
  const importFromJSON = useCallback(async () => {
    try {
      setImporting(true);
      setStatus("Loading commanders.json…");
      const dump = await loadCommandersJSON();

      setStatus(`Merging ${dump.count} commanders…`);
      const merged = mergeDumpIntoCommanders(dump, data.commanders);

      replaceCommanders(merged);
      setStatus(`Imported. Total commanders: ${merged.length}`);
    } catch (e: unknown) {
      setStatus(`Import failed: ${errorMessage(e)}`);
      console.error(e);
    } finally {
      setImporting(false);
    }
  }, [data.commanders, replaceCommanders]);

  // Auto-import on first visit when there is no data yet
  useEffect(() => {
    if (!autoTried && data.commanders.length === 0) {
      setAutoTried(true);
      void importFromJSON();
    }
  }, [autoTried, data.commanders.length, importFromJSON]);

  return (
    <section className="min-h-full grid lg:grid-cols-[320px_1fr] gap-6">
      {/* Filters */}
      <aside className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">{status}</span>
          <button
            onClick={importFromJSON}
            disabled={importing}
            className="px-4 py-2 rounded-md border border-neutral-700 hover:border-neutral-500 disabled:opacity-60"
          >
            {importing ? "Importing…" : "Update Commander List"}
          </button>
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Commander name"
            className="w-full px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700 outline-none"
          />
        </div>

        <div>
          <p className="text-sm text-neutral-400 mb-1">Colour identity</p>
          <div className="grid grid-cols-6 gap-2">
            {COLOURS_WITH_C.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setCi((s) => {
                    if (c === "C") {
                      // colourless is exclusive
                      return {
                        C: !s.C,
                        W: false,
                        U: false,
                        B: false,
                        R: false,
                        G: false,
                      };
                    }
                    // selecting any coloured pip clears C
                    return { ...s, [c]: !s[c], C: false };
                  })
                }
                className={`py-2 rounded-md border text-sm ${
                  ci[c]
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-neutral-700 bg-neutral-800"
                }`}
                title={c === "C" ? "Colourless {C}" : `Toggle ${c}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-neutral-400">
              Selected: <span className="font-mono">{activeCI || "(any)"}</span>
            </span>
            <button
              className="text-xs underline"
              onClick={() =>
                setCi({
                  C: false,
                  W: false,
                  U: false,
                  B: false,
                  R: false,
                  G: false,
                })
              }
            >
              Clear
            </button>
          </div>
        </div>

        {/* TAG FILTER */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-neutral-400">Tags</p>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setShowAllTags((v) => !v)}
                className="ml-2 px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500"
                title={showAllTags ? "Show fewer" : "Show all"}
              >
                {showAllTags ? "Show fewer" : "Show all"}
              </button>
            </div>
          </div>

          {/* Tag search */}
          <input
            value={tagQ}
            onChange={(e) => setTagQ(e.target.value)}
            placeholder="Filter tags…"
            className="w-full px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700 outline-none text-sm"
          />

          {/* Selected tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((k) => {
                const info = tagIndex.get(k);
                const label = info?.label ?? k;
                return (
                  <button
                    key={`sel-${k}`}
                    onClick={() => toggleTag(k)}
                    className="px-2 py-1 rounded-full text-xs border border-amber-400 bg-amber-500/10"
                    title="Remove tag"
                  >
                    {label} ×
                  </button>
                );
              })}
              <button
                onClick={clearTags}
                className="px-2 py-1 rounded-full text-xs border border-neutral-700 hover:border-neutral-500"
                title="Clear all tags"
              >
                Clear tags
              </button>
            </div>
          )}

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {filteredTags.map(([k, info]) => {
              const selected = selectedTags.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => toggleTag(k)}
                  className={`px-2 py-1 rounded-full text-xs border ${
                    selected
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"
                  }`}
                  title={`${info.count} decks`}
                >
                  {info.label}
                </button>
              );
            })}
            {filteredTags.length === 0 && (
              <span className="text-xs text-neutral-500">No tags found</span>
            )}
          </div>
        </div>
      </aside>

      {/* Results */}
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">
          Search Results{" "}
          <span className="text-neutral-400 text-sm">{results.length}</span>
        </h1>

        {results.length === 0 ? (
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40">
            <p className="text-neutral-400">
              No commanders match those filters. Try widening your search.
            </p>
          </div>
        ) : (
          <ul className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
            {results.map((c: Commander) => (
              <ResultCard
                key={c.id}
                base={c}
                all={data.commanders}
                onAssign={assignChallenge}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
