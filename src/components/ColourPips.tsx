import { canonicalCI, COLOURLESS, COLOURS_WITH_C } from "../lib/identity";

type Pip = typeof COLOURS_WITH_C[number];

import pipW from "../assets/pips/W.svg";
import pipU from "../assets/pips/U.svg";
import pipB from "../assets/pips/B.svg";
import pipR from "../assets/pips/R.svg";
import pipG from "../assets/pips/G.svg";
import pipC from "../assets/pips/C.svg";

const PIP_SRC: Record<Pip, string> = {
  W: pipW,
  U: pipU,
  B: pipB,
  R: pipR,
  G: pipG,
  C: pipC,
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