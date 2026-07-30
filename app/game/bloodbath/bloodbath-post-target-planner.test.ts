import { describe, expect, it } from "vitest";

import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
import {
  getBloodbathFatalProfileWeight,
  type BloodbathFatalSelectionProfile,
} from "./bloodbath-fatal-planner";
import {
  getBloodbathFatalityTargetForPostTargetReservation,
  BLOODBATH_POST_TARGET_SOLO_CEILING_WEIGHT_MULTIPLIER,
  canCoverBloodbathPostTargetParticipants,
  canCoverBloodbathPostTargetParticipantsAfterDefinition,
  getBloodbathPostTargetDefinitionWeight,
  wouldExceedBloodbathPostTargetSoloCeiling,
} from "./bloodbath-post-target-planner";

function createDefinition(id: string, participantCount: number): EventDefinition {
  return {
    id,
    category: "survival",
    tags: ["item"],
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

describe("Bloodbath post-target planner", () => {
  it("protects larger post-target groups after the established Bloodbath floor", () => {
    expect(
      getBloodbathFatalityTargetForPostTargetReservation({
        fatalityTarget: 13,
        startingTributeCount: 24,
        requestedPostTargetCount: 4,
      }),
    ).toBe(10);

    expect(
      getBloodbathFatalityTargetForPostTargetReservation({
        fatalityTarget: 6,
        startingTributeCount: 12,
        requestedPostTargetCount: 3,
      }),
    ).toBe(5);
  });

  it("keeps the complete soft target for solo and pair reservations", () => {
    expect(
      getBloodbathFatalityTargetForPostTargetReservation({
        fatalityTarget: 13,
        startingTributeCount: 24,
        requestedPostTargetCount: 2,
      }),
    ).toBe(13);

    expect(
      getBloodbathFatalityTargetForPostTargetReservation({
        fatalityTarget: 6,
        startingTributeCount: 12,
        requestedPostTargetCount: 1,
      }),
    ).toBe(6);
  });

  it("applies the Cornucopia solo penalty without escalating larger shapes", () => {
    const definitions = [
      createDefinition("solo", 1),
      createDefinition("pair", 2),
      createDefinition("trio", 3),
      createDefinition("quartet", 4),
    ];

    const ratios = definitions.map(
      (definition) =>
        getBloodbathPostTargetDefinitionWeight(definition, context, {
          selectedEventCount: 0,
          selectedSoloEventCount: 0,
          hasNonSoloCandidate: false,
        }) / getEventDefinitionWeight(definition, context),
    );

    expect(ratios[0]).toBeCloseTo(0.2);
    expect(ratios[1]).toBeCloseTo(1);
    expect(ratios[2]).toBeCloseTo(1);
    expect(ratios[3]).toBeCloseTo(1);
  });

  it("softly suppresses solo events after the ceiling when non-solo candidates exist", () => {
    const solo = createDefinition("solo", 1);
    const ordinarySoloRatio =
      getBloodbathPostTargetDefinitionWeight(solo, context, {
        selectedEventCount: 1,
        selectedSoloEventCount: 0,
        hasNonSoloCandidate: false,
      }) / getEventDefinitionWeight(solo, context);
    const ceilingSoloRatio =
      getBloodbathPostTargetDefinitionWeight(solo, context, {
        selectedEventCount: 1,
        selectedSoloEventCount: 0,
        hasNonSoloCandidate: true,
      }) / getEventDefinitionWeight(solo, context);

    expect(
      wouldExceedBloodbathPostTargetSoloCeiling({
        selectedEventCount: 1,
        selectedSoloEventCount: 0,
      }),
    ).toBe(true);
    expect(ordinarySoloRatio).toBeCloseTo(0.2);
    expect(ceilingSoloRatio).toBeCloseTo(
      0.2 * BLOODBATH_POST_TARGET_SOLO_CEILING_WEIGHT_MULTIPLIER,
    );
  });

  it("finds an exact participant cover using every definition at most once", () => {
    expect(
      canCoverBloodbathPostTargetParticipants({
        definitions: [createDefinition("pair", 2), createDefinition("trio", 3)],
        participantCount: 5,
      }),
    ).toBe(true);

    expect(
      canCoverBloodbathPostTargetParticipants({
        definitions: [createDefinition("pair", 2)],
        participantCount: 4,
      }),
    ).toBe(false);
  });

  it("rejects a selection that would strand a remaining tribute", () => {
    const selectedPair = createDefinition("selected-pair", 2);

    expect(
      canCoverBloodbathPostTargetParticipantsAfterDefinition({
        definition: selectedPair,
        remainingDefinitions: [createDefinition("remaining-trio", 3)],
        availableParticipantCount: 5,
      }),
    ).toBe(true);

    expect(
      canCoverBloodbathPostTargetParticipantsAfterDefinition({
        definition: selectedPair,
        remainingDefinitions: [createDefinition("remaining-pair", 2)],
        availableParticipantCount: 5,
      }),
    ).toBe(false);
  });

  it("keeps delayed fatalities rare inside the unified fatal pool", () => {
    const definition = createDefinition("delayed-fatal", 2);
    const profile: BloodbathFatalSelectionProfile = {
      definition,
      minImmediateEliminations: 0,
      maxImmediateEliminations: 0,
      selectionWeightMultiplier: 0.08,
    };

    expect(
      getBloodbathFatalProfileWeight(profile, context) /
        getEventDefinitionWeight(definition, context),
    ).toBeCloseTo(0.08);
  });
});
