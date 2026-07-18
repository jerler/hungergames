export const PRONOUN_SET_IDS = ["they", "she", "he", "it"] as const;

export type PronounSetId = (typeof PRONOUN_SET_IDS)[number];

export const DEFAULT_PRONOUN_SET_ID: PronounSetId = "they";

export interface PronounGrammar {
  label: string;

  subject: string;
  Subject: string;

  object: string;

  possessiveAdjective: string;
  possessivePronoun: string;

  reflexive: string;

  bePresent: "are" | "is";
  bePast: "were" | "was";
  havePresent: "have" | "has";
}

export const PRONOUN_GRAMMAR: Record<PronounSetId, PronounGrammar> = {
  they: {
    label: "They / them",
    subject: "they",
    Subject: "They",
    object: "them",
    possessiveAdjective: "their",
    possessivePronoun: "theirs",
    reflexive: "themself",
    bePresent: "are",
    bePast: "were",
    havePresent: "have",
  },

  she: {
    label: "She / her",
    subject: "she",
    Subject: "She",
    object: "her",
    possessiveAdjective: "her",
    possessivePronoun: "hers",
    reflexive: "herself",
    bePresent: "is",
    bePast: "was",
    havePresent: "has",
  },

  he: {
    label: "He / him",
    subject: "he",
    Subject: "He",
    object: "him",
    possessiveAdjective: "his",
    possessivePronoun: "his",
    reflexive: "himself",
    bePresent: "is",
    bePast: "was",
    havePresent: "has",
  },

  it: {
    label: "It / its",
    subject: "it",
    Subject: "It",
    object: "it",
    possessiveAdjective: "its",
    possessivePronoun: "its",
    reflexive: "itself",
    bePresent: "is",
    bePast: "was",
    havePresent: "has",
  },
};

export function getPronounGrammar(pronounSetId: PronounSetId | undefined): PronounGrammar {
  return PRONOUN_GRAMMAR[pronounSetId ?? DEFAULT_PRONOUN_SET_ID];
}
