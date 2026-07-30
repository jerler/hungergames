import { describe, expect, it } from "vitest";

import { getEventDefinitionWeight } from "~/game/events/event-weighting";

import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";

import {
  canCompleteBloodbathFatalityTargetAfterProfile,
  canReachBloodbathFatalityTarget,
  getBloodbathFatalProfileWeight,
  type BloodbathFatalSelectionProfile,
} from "./bloodbath-fatal-planner";

function createDefinition(id: string, participantCount: number): EventDefinition {
  return {
    id,
    category: "fatal",
    tags: ["fatal"],
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

function createProfile(
  id: string,
  participantCount: number,
  minimumEliminations: number,
  maximumEliminations = minimumEliminations,
): BloodbathFatalSelectionProfile {
  return {
    definition: createDefinition(id, participantCount),
    minImmediateEliminations: minimumEliminations,
    maxImmediateEliminations: maximumEliminations,
  };
}

const context = {
  state: {},
  round: {
    day: 1,
    period: "day",
  },
  livingTributes: Array.from({ length: 12 }, (_, index) => ({ id: `tribute-${index}` })),
} as unknown as EventSelectionContext;

describe("Bloodbath fatal candidate planner", () => {
  it("applies the Bloodbath solo penalty without escalating larger shapes", () => {
    const solo = createProfile("solo", 1, 1);
    const pair = createProfile("pair", 2, 1);
    const trio = createProfile("trio", 3, 2);
    const group = createProfile("group", 4, 2);

    const shapeMultiplier = (profile: BloodbathFatalSelectionProfile): number =>
      getBloodbathFatalProfileWeight(profile, context) /
      getEventDefinitionWeight(profile.definition, context);

    expect(shapeMultiplier(solo)).toBeCloseTo(0.2);
    expect(shapeMultiplier(pair)).toBeCloseTo(1);
    expect(shapeMultiplier(trio)).toBeCloseTo(1);
    expect(shapeMultiplier(group)).toBeCloseTo(1);
  });

  it("finds an exact fatality composition across different shapes", () => {
    expect(
      canReachBloodbathFatalityTarget({
        profiles: [createProfile("pair-one", 2, 1), createProfile("solo-one", 1, 1)],
        availableParticipantCount: 3,
        fatalityDeficit: 2,
      }),
    ).toBe(true);
  });

  it("accepts the existing one-death soft overshoot", () => {
    expect(
      canReachBloodbathFatalityTarget({
        profiles: [createProfile("trio-two", 3, 2)],
        availableParticipantCount: 3,
        fatalityDeficit: 1,
      }),
    ).toBe(true);
  });

  it("rejects a composition that cannot reach the remaining target", () => {
    expect(
      canReachBloodbathFatalityTarget({
        profiles: [createProfile("pair-one", 2, 1)],
        availableParticipantCount: 2,
        fatalityDeficit: 2,
      }),
    ).toBe(false);
  });

  it("keeps a candidate only when every authored outcome leaves a completion path", () => {
    const remainingSolo = createProfile("remaining-solo", 1, 1);

    expect(
      canCompleteBloodbathFatalityTargetAfterProfile({
        profile: createProfile("guaranteed-pair", 2, 1),
        remainingProfiles: [remainingSolo],
        availableParticipantCount: 3,
        fatalityDeficit: 2,
      }),
    ).toBe(true);

    expect(
      canCompleteBloodbathFatalityTargetAfterProfile({
        profile: createProfile("variable-pair", 2, 0, 1),
        remainingProfiles: [remainingSolo],
        availableParticipantCount: 3,
        fatalityDeficit: 2,
      }),
    ).toBe(false);
  });
});
