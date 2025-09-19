import { canonicalCI, COLOURLESS, COLOURS_WITH_C } from "../lib/identity";

type Pip = typeof COLOURS_WITH_C[number];

const PIP_SRC: Record<Pip, string> = {
  C: "https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/1/1a/C.svg/revision/latest?cb=20160121092204",
  W: "https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/8/8e/W.svg/revision/latest?cb=20160125094923",
  U: "https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/9/9f/U.svg/revision/latest?cb=20160121092256",
  B: "https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/2/2f/B.svg/revision/latest?cb=20160125093423",
  R: "https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/8/87/R.svg/revision/latest?cb=20160125094913",
  G: "https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/8/88/G.svg/revision/latest?cb=20160125094907",
};

export function ColourPips({
  ci,
  showLetters = true,
  size = 18,
  gap = 6,
}: {
  ci: string;
  showLetters?: boolean;
  size?: number;
  gap?: number;
}) {
  // Canonicalise to W U B R G, with special handling for colourless
  const canonical = canonicalCI(ci);

  // If colourless, show just C; otherwise split the coloured pips
  const pips: Pip[] =
    canonical === COLOURLESS
      ? [COLOURLESS]
      : (canonical.split("") as unknown as Pip[]); // canonical only contains W/U/B/R/G here

  return (
    <span className="inline-flex items-center gap-2">
      {showLetters && <span className="font-mono tracking-wide">{canonical}</span>}
      <span className="inline-flex items-center" style={{ columnGap: gap }}>
        {pips.map((p) => (
          <img
            key={p}
            src={PIP_SRC[p]}
            alt={`${p} pip`}
            width={size}
            height={size}
            className="inline-block align-middle shrink-0"
            loading="lazy"
          />
        ))}
      </span>
    </span>
  );
}