import { describe, expect, it } from "vitest";

import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import {
  canCoverBloodbathFleeParticipants,
  canCoverBloodbathFleeParticipantsAfterDefinition,
  getBloodbathFleeDefinitionWeight,
} from "./bloodbath-flee-planner";

function createDefinition(id: string, participantCount: number): EventDefinition {
  return {
    id,
    category: "survival",
    tags: ["survival", "environment"],
    periods: ["day"],
    baseWeight: 1,
    roles: [
      {
        id: "tributes",
        count: participantCount,
      },
    ],
    resolve: () => ({
      text: id,
      changes: [],
    }),
  };
}

const context = {
  state: {},
  round: {
    day: 1,
    period: "day",
  },
  livingTributes: [],
} as unknown as EventSelectionContext;

describe("Bloodbath flee planner", () => {
  it("applies the strong solo penalty without escalating larger shapes", () => {
    const definitions = [
      createDefinition("solo", 1),
      createDefinition("pair", 2),
      createDefinition("trio", 3),
      createDefinition("quartet", 4),
    ];

    const ratios = definitions.map(
      (definition) =>
        getBloodbathFleeDefinitionWeight(definition, context) /
        getEventDefinitionWeight(definition, context),
    );

    expect(ratios[0]).toBeCloseTo(0.2);
    expect(ratios[1]).toBeCloseTo(1);
    expect(ratios[2]).toBeCloseTo(1);
    expect(ratios[3]).toBeCloseTo(1);
  });

  it("finds an exact cover using each flee definition at most once", () => {
    expect(
      canCoverBloodbathFleeParticipants({
        definitions: [createDefinition("pair", 2), createDefinition("trio", 3)],
        participantCount: 5,
      }),
    ).toBe(true);

    expect(
      canCoverBloodbathFleeParticipants({
        definitions: [createDefinition("only-pair", 2)],
        participantCount: 4,
      }),
    ).toBe(false);
  });

  it("rejects selections that would strand the remaining fleeing tribute", () => {
    const selectedPair = createDefinition("selected-pair", 2);

    expect(
      canCoverBloodbathFleeParticipantsAfterDefinition({
        definition: selectedPair,
        remainingDefinitions: [createDefinition("remaining-trio", 3)],
        availableParticipantCount: 5,
      }),
    ).toBe(true);

    expect(
      canCoverBloodbathFleeParticipantsAfterDefinition({
        definition: selectedPair,
        remainingDefinitions: [createDefinition("remaining-pair", 2)],
        availableParticipantCount: 5,
      }),
    ).toBe(false);
  });
});
