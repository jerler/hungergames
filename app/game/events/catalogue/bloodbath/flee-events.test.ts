import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, ParticipantsByRole } from "~/game/events/event-schema";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import type { GameChange, GameState, GameTribute } from "~/game/types/game-state";

import { FLEE_EVENTS } from "./flee-events";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const OUTCOME_RANDOM_VALUES = [0, 0.2, 0.7, 0.99] as const;

function createTestTributes(): [GameTribute, GameTribute] {
  return [
    createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    }),
    createAuthoringTestTribute({
      id: "ally",
      name: "Ally",
      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    }),
  ];
}

function createParticipantsByRole(
  definition: EventDefinition,
  tributes: readonly GameTribute[],
): ParticipantsByRole {
  const participantsByRole: Record<string, GameTribute[]> = {};
  let nextTributeIndex = 0;

  for (const role of definition.roles) {
    const participants = tributes.slice(nextTributeIndex, nextTributeIndex + role.count);

    if (participants.length !== role.count) {
      throw new Error(`Event "${definition.id}" could not receive role "${role.id}" in its test.`);
    }

    participantsByRole[role.id] = participants;
    nextTributeIndex += role.count;
  }

  return participantsByRole;
}

function resolveDefinition(definition: EventDefinition, randomValue: number) {
  const tributes = createTestTributes();
  const state: GameState = {
    ...createAuthoringTestGame(tributes),
    currentRound: DAY_ONE,
  };
  const eventId = `test:${definition.id}:${randomValue}`;
  const resolution = definition.resolve({
    state,
    round: DAY_ONE,
    livingTributes: tributes,
    eventId,
    random: () => randomValue,
    participantsByRole: createParticipantsByRole(definition, tributes),
    unavailableItemInstanceIds: new Set<string>(),
  });

  validateEventResolution({
    eventId,
    definitionId: definition.id,
    round: DAY_ONE,
    resolution,
  });

  return {
    resolution,
    state,
    tributes,
  };
}

function requireDefinition(id: string): EventDefinition {
  const definition = FLEE_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing flee event "${id}".`);
  }

  return definition;
}

function getEliminations(changes: readonly GameChange[]) {
  return changes.filter((change) => change.type === "eliminate-tribute");
}

function getStatuses(changes: readonly GameChange[]) {
  return changes.flatMap((change) => (change.type === "apply-status" ? [change.status] : []));
}

describe("Bloodbath flee events", () => {
  it("registers all fourteen approved concepts exactly once", () => {
    const ids = FLEE_EVENTS.map((definition) => definition.id);

    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      FLEE_EVENTS.every(
        (definition) => definition.periods.length === 1 && definition.periods[0] === "day",
      ),
    ).toBe(true);
  });

  it("resolves and validates all four outcomes for every definition", () => {
    for (const definition of FLEE_EVENTS) {
      for (const randomValue of OUTCOME_RANDOM_VALUES) {
        const { resolution } = resolveDefinition(definition, randomValue);

        expect(resolution.text.trim()).not.toBe("");
      }
    }
  });

  it("uses immediate fatalities only for the approved lethal branches", () => {
    const expectedFatalOutcomes = [
      ["bloodbath-flee-leap-across-creek", 0],
      ["bloodbath-flee-cross-fallen-tree", 0],
      ["bloodbath-flee-cross-fallen-tree", 0.2],
      ["bloodbath-flee-escape-stampede", 0],
    ] as const;

    for (const [definitionId, randomValue] of expectedFatalOutcomes) {
      const { resolution } = resolveDefinition(requireDefinition(definitionId), randomValue);
      const eliminations = getEliminations(resolution.changes);

      expect(eliminations).toHaveLength(1);
      expect(eliminations[0]?.killerTributeIds).toEqual([]);
    }
  });

  it("keeps poison and bleeding as delayed threats", () => {
    const poisonResolution = resolveDefinition(
      requireDefinition("bloodbath-flee-emergency-foraging"),
      0,
    ).resolution;
    const bleedingResolution = resolveDefinition(
      requireDefinition("bloodbath-flee-bramble-shortcut"),
      0,
    ).resolution;

    expect(getEliminations(poisonResolution.changes)).toHaveLength(0);
    expect(getEliminations(bleedingResolution.changes)).toHaveLength(0);

    expect(
      getStatuses(poisonResolution.changes).some(
        (status) => status.definitionId === "poisoned" && status.severity === 2,
      ),
    ).toBe(true);
    expect(
      getStatuses(bleedingResolution.changes).some((status) => status.definitionId === "bleeding"),
    ).toBe(true);
  });

  it("forms a two-person truce and hides both tributes on exceptional success", () => {
    const { resolution, tributes } = resolveDefinition(
      requireDefinition("bloodbath-flee-break-away-crowd"),
      0.99,
    );
    const truceChanges = resolution.changes.flatMap((change) =>
      change.type === "form-truce" ? [change] : [],
    );
    const hiddenTributeIds = resolution.changes.flatMap((change) =>
      change.type === "apply-status" && change.status.definitionId === "hidden"
        ? [change.tributeId]
        : [],
    );

    expect(truceChanges).toHaveLength(1);
    expect(truceChanges[0]?.truce.tributeIds).toEqual(tributes.map((tribute) => tribute.id));
    expect(new Set(hiddenTributeIds)).toEqual(new Set(tributes.map((tribute) => tribute.id)));
  });

  it("persists the stampede knife without granting provisions", () => {
    const { resolution } = resolveDefinition(
      requireDefinition("bloodbath-flee-escape-stampede"),
      0.99,
    );
    const acquisitions = resolution.changes.flatMap((change) =>
      change.type === "acquire-item" ? [change] : [],
    );

    expect(acquisitions).toHaveLength(1);
    expect(acquisitions[0]?.item.definitionId).toBe("knife");
    expect(acquisitions[0]?.acquisitionSource).toBe("cornucopia");
    expect(
      acquisitions.some((change) => change.item.definitionId === "cornucopia-provisions"),
    ).toBe(false);
  });

  it("keeps fatal-capable concepts rarer than ordinary flee events", () => {
    const fatalCapable = FLEE_EVENTS.filter((definition) => definition.tags.includes("fatal"));
    const ordinary = FLEE_EVENTS.filter((definition) => !definition.tags.includes("fatal"));
    const highestFatalWeight = Math.max(...fatalCapable.map((definition) => definition.baseWeight));
    const lowestOrdinaryWeight = Math.min(...ordinary.map((definition) => definition.baseWeight));

    expect(fatalCapable).toHaveLength(3);
    expect(highestFatalWeight).toBeLessThan(lowestOrdinaryWeight);
  });
});
