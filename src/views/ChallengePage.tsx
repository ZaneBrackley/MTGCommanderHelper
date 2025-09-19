import { useState } from "react";
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
        Pick and lock a commander (or partner pair) on the Search page for every colour identity.
      </p>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {COLOUR_COMBOS.map((ci) => {
          const choice: ChallengeChoice | undefined = data.challenge[ci];

          const primary: Commander | undefined =
            choice ? data.commanders.find((c) => c.id === choice.primaryId) : undefined;

          const partner: Commander | undefined =
            choice?.partnerId ? data.commanders.find((c) => c.id === choice.partnerId) : undefined;

          return <ChallengeTile key={ci} ci={ci} primary={primary} partner={partner} />;
        })}
      </ul>
    </section>
  );
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
  const [showPartner, setShowPartner] = useState(false);
  const current = showPartner && partner ? partner : primary;

  return (
    <li className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40">
      {/* Header with pips + colour name (no flip button up here) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ColourPips ci={ci} showLetters={false} size={18} />
          <span className="font-semibold">{nameForCI(ci, { withAlias: true })}</span>
        </div>
      </div>

      {!primary ? (
        <p className="text-neutral-400 text-sm">Use the Search page to assign a commander.</p>
      ) : (
        <div className="space-y-3">
          {/* Single image that flips when there's a partner */}
          <CardThumb
            src={current?.image}
            alt={`${current?.name ?? "Commander"} card art`}
            href={current?.scryfall}
          />

          {/* Always show both names when partner exists */}
          <div className="text-sm">
            <p className="font-medium">
              {primary.name}
              {partner ? <span> &amp; {partner.name}</span> : null}
            </p>
          </div>

          {/* Flip button UNDER the names (only when pair exists) */}
          {primary && partner && (
            <div>
              <button
                onClick={() => setShowPartner((v) => !v)}
                className="px-3 py-1.5 rounded border border-neutral-700 text-xs hover:border-neutral-500 justify-center w-full"
                title={`Show ${showPartner ? primary.name : partner.name}`}
                aria-label={`Flip to ${showPartner ? primary.name : partner.name}`}
              >
                Flip to {showPartner ? primary.name : partner.name}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
