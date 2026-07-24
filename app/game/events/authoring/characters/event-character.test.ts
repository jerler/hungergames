import { describe, expect, it } from "vitest";

import type { GameTribute } from "~/game/types/game-state";
import type { PronounSetId } from "~/game/tributes/pronouns";
import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import { createEventCharacter } from "./event-character";

function createTribute(pronouns: PronounSetId): GameTribute {
  return {
    id: `tribute-${pronouns}`,
    sourceDefinitionId: null,

    district: 1,
    districtPosition: 1,

    snapshot: {
      name: "Test Tribute",
      pronouns,
      portraitUrl: null,

      stats: {
        brains: 4,
        brawn: 3,
        luck: 2,
      },
    },

    isAlive: true,
    death: null,
    survival: createDefaultTributeSurvivalState(),

    statuses: [],
    inventory: [],

    allianceId: null,

    statistics: {
      kills: 0,
      attemptedKills: 0,
      giftsReceived: 0,
      eventsSurvived: 0,
    },
  };
}

describe("createEventCharacter", () => {
  it("exposes friendly tribute properties", () => {
    const tribute = createTribute("she");
    const character = createEventCharacter(tribute);

    expect(character.id).toBe(tribute.id);
    expect(character.name).toBe("Test Tribute");

    expect(character.stats).toEqual({
      brains: 4,
      brawn: 3,
      luck: 2,
    });

    expect(character.tribute).toBe(tribute);
  });

  it.each([
    {
      pronounSet: "they",
      subject: "they",
      capitalSubject: "They",
      object: "them",
      possessiveAdjective: "their",
      possessivePronoun: "theirs",
      reflexive: "themself",
      bePresent: "are",
      bePast: "were",
      havePresent: "have",
      verb: "wash",
    },
    {
      pronounSet: "she",
      subject: "she",
      capitalSubject: "She",
      object: "her",
      possessiveAdjective: "her",
      possessivePronoun: "hers",
      reflexive: "herself",
      bePresent: "is",
      bePast: "was",
      havePresent: "has",
      verb: "washes",
    },
    {
      pronounSet: "he",
      subject: "he",
      capitalSubject: "He",
      object: "him",
      possessiveAdjective: "his",
      possessivePronoun: "his",
      reflexive: "himself",
      bePresent: "is",
      bePast: "was",
      havePresent: "has",
      verb: "washes",
    },
    {
      pronounSet: "it",
      subject: "it",
      capitalSubject: "It",
      object: "it",
      possessiveAdjective: "its",
      possessivePronoun: "its",
      reflexive: "itself",
      bePresent: "is",
      bePast: "was",
      havePresent: "has",
      verb: "washes",
    },
  ] as const)(
    "exposes correct $pronounSet grammar",
    ({
      pronounSet,
      subject,
      capitalSubject,
      object,
      possessiveAdjective,
      possessivePronoun,
      reflexive,
      bePresent,
      bePast,
      havePresent,
      verb,
    }) => {
      const character = createEventCharacter(createTribute(pronounSet));

      expect(character.pronouns.subject).toBe(subject);

      expect(character.pronouns.Subject).toBe(capitalSubject);

      expect(character.pronouns.object).toBe(object);

      expect(character.pronouns.possessiveAdjective).toBe(possessiveAdjective);

      expect(character.pronouns.possessivePronoun).toBe(possessivePronoun);

      expect(character.pronouns.reflexive).toBe(reflexive);

      expect(character.pronouns.bePresent).toBe(bePresent);

      expect(character.pronouns.bePast).toBe(bePast);

      expect(character.pronouns.havePresent).toBe(havePresent);

      expect(character.pronouns.verb("wash", "washes")).toBe(verb);
    },
  );
});
