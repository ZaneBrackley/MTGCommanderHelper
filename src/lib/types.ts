export type Commander = {
  id: string;
  name: string;
  colourIdentity: string;
  scryfall?: string;
  image?: string | null;
  tags?: string[];
  tagCounts?: Record<string, number>;
  partnerKind?: "none" | "partner" | "partnerWith" | "friendsForever" | "chooseBackground" | "background";
  partnerWithNames?: string[];
  edhrecRank?: number;
  edhrecUri?: string;
};

export type ChallengeLock = Record<string, string>; // colourIdentity -> commanderId

export type PartnerKind =
  | "none"
  | "partner"           // “Partner” (generic)
  | "partnerWith"       // “Partner with <name>”
  | "friendsForever"    // “Friends forever”
  | "chooseBackground"  // “Choose a Background”
  | "background";       // the Background card itself

export type ChallengeChoice = {
  primaryId: string;
  partnerId?: string; // optional
};

export type SaveData = {
  commanders: Commander[];
  // challenge is now a map from colour identity → the chosen pair (or single)
  challenge: Record<string, ChallengeChoice>;
};
