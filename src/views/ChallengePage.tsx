import { useEffect, useMemo, useState } from "react";
import { COLOUR_COMBOS } from "../lib/identity";
import { useData } from "../state/DataContext";
import CardThumb from "../components/CardThumb";
import type { Commander, ChallengeChoice } from "../lib/types";
import { ColourPips } from "../components/ColourPips";
import { nameForCI } from "../lib/colourNames";

export default function ChallengePage() {
  const { data } = useData();

  return (
    <section className="space-y-4 mx-auto w-410 px-4">
      <h1 className="text-3xl font-semibold">32-Deck Challenge</h1>
      <p className="text-neutral-400">
        Pick and lock a commander (or partner pair) on the Search page for every
        colour identity.
      </p>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {COLOUR_COMBOS.map((ci) => {
          const choice: ChallengeChoice | undefined = data.challenge[ci];
          const primary: Commander | undefined = choice
            ? data.commanders.find((c) => c.id === choice.primaryId)
            : undefined;
          const partner: Commander | undefined = choice?.partnerId
            ? data.commanders.find((c) => c.id === choice.partnerId)
            : undefined;

          return (
            <ChallengeTile
              key={ci}
              ci={ci}
              primary={primary}
              partner={partner}
            />
          );
        })}
      </ul>
    </section>
  );
}

function scryfallImgById(
  id: string,
  face: "front" | "back" = "front",
  version: "normal" | "large" = "normal"
) {
  const base = `https://api.scryfall.com/cards/${id}?format=image&version=${version}`;
  return face === "back" ? `${base}&face=back` : base;
}

function ChallengeTile({
  ci,
  primary,
  partner,
}: {
  ci: string;
  primary?: Commander;
  partner?: Commander;
}) {
  const { clearChallenge } = useData();
  const [showPartner, setShowPartner] = useState(false);
  const [hasBack, setHasBack] = useState(false);
  const [showBack, setShowBack] = useState(false);

  const current: Commander | undefined =
    showPartner && partner ? partner : primary;

  // Union of tags from primary and partner (deduped)
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const t of primary?.tags ?? []) set.add(t);
    for (const t of partner?.tags ?? []) set.add(t);
    return [...set];
  }, [primary?.tags, partner?.tags]);

  // MDFC / transform support: show Transform if there is a real back image
  const currentId = current?.id;
  const currentName = current?.name;

  useEffect(() => {
    setShowBack(false);

    if (!currentName || !currentId || !currentName.includes("//")) {
      setHasBack(false);
      return;
    }

    const test = new Image();
    const url = scryfallImgById(currentId, "back", "normal");
    test.onload = () => setHasBack(true);
    test.onerror = () => setHasBack(false);
    test.src = url;

    return () => {
      test.onload = null;
      test.onerror = null;
    };
  }, [currentId, currentName]);

  const imgSrc =
    showBack && currentId
      ? scryfallImgById(currentId, "back", "normal")
      : current?.image;

  return (
    <li className="flex flex-col p-6 rounded-xl border border-neutral-800 bg-neutral-900/40">
      {/* Header: pips + CI name */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ColourPips ci={ci} showLetters={false} size={18} />
          <span className="font-semibold">
            {nameForCI(ci, { withAlias: true })}
          </span>
        </div>
      </div>

      {!primary ? (
        <p className="text-neutral-400 text-sm">
          Use the Search page to assign a commander.
        </p>
      ) : (
        <>
          <CardThumb
            src={imgSrc}
            alt={`${current?.name ?? "Commander"} card art`}
            href={current?.scryfall}
          />

          <div className="">
            <p className="font-medium clamp-2">
              {primary.edhrecUri ? (
                <a
                  href={primary.edhrecUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted hover:decoration-solid"
                >
                  {primary.name}
                </a>
              ) : (
                primary.name
              )}
              {partner && (
                <>
                  {" "}
                  &{" "}
                  {partner.edhrecUri ? (
                    <a
                      href={partner.edhrecUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-dotted hover:decoration-solid"
                    >
                      {partner.name}
                    </a>
                  ) : (
                    partner.name
                  )}
                </>
              )}
            </p>
          </div>

          {/* Tags (union) */}
          {tags.length > 0 && (
            <p className="text-xs text-neutral-400 clamp-2 mt-1">
              {tags.slice(0, 12).join(" · ")}
            </p>
          )}

          {/* Remove + Flip/Transform controls */}
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              {partner && (
                <button
                  onClick={() => setShowPartner((v) => !v)}
                  className="flex-1 px-3 py-1.5 rounded border border-blue-500 text-blue-300 hover:bg-blue-500/10 text-xs"
                  title={`Show ${showPartner ? primary.name : partner.name}`}
                >
                  Flip to {showPartner ? primary.name : partner.name}
                </button>
              )}
              {hasBack && (
                <button
                  onClick={() => setShowBack((v) => !v)}
                  className="flex-1 px-3 py-1.5 rounded border border-gray-500 text-gray-300 hover:bg-gray-500/10 text-xs"
                  title={showBack ? "Show front" : "Show back / transformed"}
                >
                  {showBack ? "Show Front" : "Transform"}
                </button>
              )}
            </div>
            <button
              onClick={() => clearChallenge(ci)}
              className="px-3 py-1.5 rounded border border-red-600 text-red-400 hover:bg-red-600/10 text-xs"
            >
              Remove from challenge
            </button>
          </div>
        </>
      )}
    </li>
  );
}
