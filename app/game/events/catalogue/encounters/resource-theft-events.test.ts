import { describe, expect, it } from "vitest";

import type { RandomSource } from "~/game/engine/random";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { DEPRIVATION_EVENTS } from "~/game/events/catalogue/encounters/deprivation-events";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

import { STEAL_FROM_STRONGER_TRIBUTE_EVENT } from "./theft-events";
import {
  FOOD_THEFT_EVENTS,
  RESOURCE_THEFT_EVENTS,
  WATER_THEFT_EVENTS,
} from "./resource-theft-events";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const DAY_THREE = {
  day: 3,
  period: "day",
} as const satisfies RoundReference;

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  const fallback = values.at(-1) ?? 0;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;
    return value;
  };
}

function createFixture(): {
  state: GameState;
  thief: GameTribute;
  target: GameTribute;
  context: EventSelectionContext;
} {
  const thief = createAuthoringTestTribute({
    id: "resource-thief",
    name: "Pac-Man",
    stats: {
      brains: 3,
      brawn: 1,
      luck: 3,
    },
  });
  const targetBase = createAuthoringTestTribute({
    id: "resource-target",
    name: "Batman",
    stats: {
      brains: 3,
      brawn: 5,
      luck: 3,
    },
  });
  const target = {
    ...targetBase,
    survival: {
      ...targetBase.survival,
      lastFoundFoodRound: DAY_TWO,
      lastFoundWaterRound: DAY_TWO,
    },
  };
  const state = {
    ...createAuthoringTestGame([thief, target]),
    currentRound: DAY_THREE,
  };

  return {
    state,
    thief,
    target,
    context: {
      state,
      round: DAY_THREE,
      livingTributes: [thief, target],
    },
  };
}

function requireEvent(events: readonly EventDefinition[]): EventDefinition {
  const event = events[0];

  if (!event) {
    throw new Error("Missing resource theft event.");
  }

  return event;
}

function select(
  definition: EventDefinition,
  context: EventSelectionContext,
  unavailableTributeIds: ReadonlySet<string> = new Set<string>(),
) {
  return selectEventParticipants(
    definition,
    context,
    () => 0,
    unavailableTributeIds,
    new Set<string>(),
  );
}

function resolve(definition: EventDefinition, randomValues: readonly number[]) {
  const fixture = createFixture();
  const selection = select(definition, fixture.context);

  if (!selection) {
    throw new Error(`Could not select "${definition.id}".`);
  }

  const eventId = `day-3-0-${definition.id}`;

  return {
    fixture,
    selection,
    resolution: definition.resolve({
      ...fixture.context,
      eventId,
      random: createSequenceRandom(randomValues),
      participantsByRole: selection.participantsByRole,
      itemsByRole: selection.itemsByRole,
      unavailableItemInstanceIds: new Set<string>(),
    }),
  };
}

describe("resource theft events", () => {
  it("creates separate day-only food and water families without item selection", () => {
    expect(FOOD_THEFT_EVENTS).toHaveLength(1);
    expect(WATER_THEFT_EVENTS).toHaveLength(1);
    expect(RESOURCE_THEFT_EVENTS).toHaveLength(2);

    for (const definition of RESOURCE_THEFT_EVENTS) {
      expect(definition.periods).toEqual(["day"]);
      expect(definition.tags).toEqual(
        expect.arrayContaining(["hazard", "resource", "deprivation"]),
      );

      for (const role of definition.roles) {
        expect(role.requiredItemDefinitionIds).toBeUndefined();
        expect(role.requiredItemTags).toBeUndefined();
        expect(role.optionalItemDefinitionIds).toBeUndefined();
        expect(role.optionalItemTags).toBeUndefined();
      }
    }
  });

  it.each([
    [FOOD_THEFT_EVENTS, "food"],
    [WATER_THEFT_EVENTS, "water"],
  ] as const)("satisfies only the matching need on success", (events, need) => {
    const { fixture, selection, resolution } = resolve(requireEvent(events), [0.7, 0]);

    expect(selection.selectedItemInstanceIds).toEqual([]);
    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: fixture.thief.id,
      need,
    });
    expect(
      resolution.changes.some(
        (change) =>
          change.type === "transfer-item" ||
          change.type === "acquire-item" ||
          change.type === "use-item" ||
          change.type === "consume-item",
      ),
    ).toBe(false);
  });

  it("gives failed thieves no resource reset", () => {
    const { resolution } = resolve(requireEvent(FOOD_THEFT_EVENTS), [0.3, 0]);

    expect(resolution.changes.some((change) => change.type === "satisfy-survival-need")).toBe(
      false,
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        status: expect.objectContaining({
          definitionId: "hunted",
        }),
      }),
    );
  });

  it("allows the target to kill the thief on critical failure", () => {
    const { fixture, resolution } = resolve(requireEvent(WATER_THEFT_EVENTS), [0, 0]);

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: fixture.thief.id,
        killerTributeIds: [fixture.target.id],
      }),
    );
  });

  it("resolves deterministically for the same random sequence", () => {
    const first = resolve(requireEvent(FOOD_THEFT_EVENTS), [0.7, 0.9]).resolution;
    const second = resolve(requireEvent(FOOD_THEFT_EVENTS), [0.7, 0.9]).resolution;

    expect(second).toEqual(first);
  });

  it("uses participant availability to block contradictory same-round deprivation events", () => {
    const fixture = createFixture();
    const theftSelection = select(requireEvent(FOOD_THEFT_EVENTS), fixture.context);

    if (!theftSelection) {
      throw new Error("Could not select food theft.");
    }

    const hungerDefinition = DEPRIVATION_EVENTS.find(
      (definition) => definition.id === "becomes-hungry",
    );

    if (!hungerDefinition) {
      throw new Error("Missing hunger event.");
    }

    expect(
      select(hungerDefinition, fixture.context, new Set(theftSelection.participantTributeIds)),
    ).toBeNull();
  });

  it("does not target an active truce partner", () => {
    const fixture = createFixture();
    const stateWithTruce = {
      ...fixture.state,
      truces: [
        createTruceInstance(
          "protected-pair",
          [fixture.thief.id, fixture.target.id],
          DAY_TWO,
          DAY_THREE,
        ),
      ],
    };

    expect(
      select(requireEvent(WATER_THEFT_EVENTS), {
        ...fixture.context,
        state: stateWithTruce,
      }),
    ).toBeNull();
  });

  it("leaves Cornucopia provisions in generic inventory theft", () => {
    const targetRole = STEAL_FROM_STRONGER_TRIBUTE_EVENT.roles.find((role) => role.id === "target");

    expect(targetRole?.requiredItemDefinitionIds).toContain("cornucopia-provisions");

    for (const definition of RESOURCE_THEFT_EVENTS) {
      expect(
        definition.roles.some((role) =>
          role.requiredItemDefinitionIds?.includes("cornucopia-provisions"),
        ),
      ).toBe(false);
    }
  });
});
