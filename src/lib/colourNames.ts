import { canonicalCI } from "./identity";

/** Names for each colour identity (canonical order). */
const NAMES: Record<string, { name: string; alias?: string }> = {
  // Mono
  W: { name: "White" },
  U: { name: "Blue" },
  B: { name: "Black" },
  R: { name: "Red" },
  G: { name: "Green" },
  C: { name: "Colourless" },

  // Guilds (two-colour)
  WU: { name: "Azorius" },
  UB: { name: "Dimir" },
  BR: { name: "Rakdos" },
  RG: { name: "Gruul" },
  WG: { name: "Selesnya" },
  WB: { name: "Orzhov" },
  UR: { name: "Izzet" },
  BG: { name: "Golgari" },
  WR: { name: "Boros" },
  UG: { name: "Simic" },

  // Shards (Alara)
  WUB: { name: "Esper" },
  UBR: { name: "Grixis" },
  BRG: { name: "Jund" },
  WRG: { name: "Naya" },
  WUG: { name: "Bant" },

  // Wedges (Khans)
  WBR: { name: "Mardu" },
  URG: { name: "Temur" },
  WBG: { name: "Abzan" },
  WUR: { name: "Jeskai" },
  UBG: { name: "Sultai" },

  // Four-colour (Commander 2016) — use Sans-* as primary, Nephilim as alias
  WUBR: { name: "Yore-Tiller" },
  UBRG: { name: "Glint-Eye" },
  WBRG: { name: "Dune-Brood" },
  WURG: { name: "Ink-Treader" },
  WUBG: { name: "Witch-Maw" },

  // Five-colour
  WUBRG: { name: "Domain" },
};

/** Get a nice display name for a colour identity. */
export function nameForCI(ci: string, opts?: { withAlias?: boolean }): string {
  const key = canonicalCI(ci);
  const entry = NAMES[key];
  if (!entry) return key || "Unknown";
  if (opts?.withAlias && entry.alias) return `${entry.name} (${entry.alias})`;
  return entry.name;
}
