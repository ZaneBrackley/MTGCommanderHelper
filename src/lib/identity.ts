export const COLOUR_COMBOS: string[] = [
  "W","U","B","R","G","C",
  "WU","UB","BR","RG","WG",
  "WB","UR","BG","WR","UG",
  "WUB","UBR","BRG","WRG","WUG",
  "WBR","URG","WBG","WUR","UBG",
  "WUBR","UBRG","WBRG","WURG","WUBG",
  "WUBRG",
];

export const COLOUR_PIPS = ["W", "U", "B", "R", "G"] as const; // normal colours
export const COLOURLESS = "C" as const; // colourless pip
export const COLOURS_WITH_C = [COLOURLESS, ...COLOUR_PIPS] as const;
const ORDER = ["W", "U", "B", "R", "G", "C"] as const;

export type Colour = (typeof COLOUR_PIPS)[number] | typeof COLOURLESS;
type ColourPip = typeof ORDER[number];

const ORDER_STR = ORDER as readonly string[];

function isColourPip(s: string): s is ColourPip {
  return ORDER_STR.includes(s);
}


export function canonicalCI(ci: string | string[]): string {
  const arr = Array.isArray(ci)
    ? ci
    : ci.toUpperCase().replace(/[^CWUBRG]/g, "").split("");
  const hasColoured = arr.some((ch) =>
    (COLOUR_PIPS as readonly string[]).includes(ch)
  );
  if (hasColoured) {
    return arr
      .filter((c): c is (typeof COLOUR_PIPS)[number] =>
        (COLOUR_PIPS as readonly string[]).includes(c)
      )
      .sort(
        (a, b) =>
          (COLOUR_PIPS as readonly string[]).indexOf(a) -
          (COLOUR_PIPS as readonly string[]).indexOf(b)
      )
      .join("");
  }
  // no coloured pips: treat as colourless if C present OR empty (Scryfall [] for colourless)
  const hasC = arr.includes(COLOURLESS);
  return hasC || arr.length === 0 ? COLOURLESS : "";
}

export const ciKey = canonicalCI;

export function ciEquals(a: string | string[], b: string | string[]) {
  return canonicalCI(a) === canonicalCI(b);
}

export const ciDisplay = canonicalCI;

export function unionCI(a: string, b?: string): string {
  const letters = (a + (b ?? ""))
    .toUpperCase()
    .replace(/[^WUBRGC]/g, "")
    .split("");

  const filtered = letters.filter(isColourPip);
  const set = new Set<ColourPip>(filtered);

  // If any coloured pip is present, drop C
  if (COLOUR_PIPS.some((p) => set.has(p))) set.delete("C");

  return Array.from(set)
    .sort((x, y) => ORDER_STR.indexOf(x) - ORDER_STR.indexOf(y))
    .join("");
}

