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

function createTestTributes(): GameTribute[] {
  return Array.from(
    {
      length: 4,
    },
    (_, index) =>
      createAuthoringTestTribute({
        id: `tribute-${index + 1}`,
        name: `Tribute ${index + 1}`,
        stats: {
          brains: 3,
          brawn: 3,
          luck: 3,
        },
      }),
  );
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
    participantsByRole: createParticipantsByRole(definition, tributes),
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
  it("registers all thirty-one approved concepts exactly once", () => {
    const ids = FLEE_EVENTS.map((definition) => definition.id);

    expect(ids).toHaveLength(31);
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
    const fatalCases = [
      {
        definitionId: "bloodbath-flee-leap-across-creek",
        randomValue: 0,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-cross-fallen-tree",
        randomValue: 0,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-cross-fallen-tree",
        randomValue: 0.2,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-escape-stampede",
        randomValue: 0,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-pair-fallen-log-cooperation",
        randomValue: 0.3,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [1],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-pair-fallen-log-cooperation",
        randomValue: 0.4,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [0],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-pair-abandoned-at-creek",
        randomValue: 0,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [0],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-narrow-deer-path",
        randomValue: 0.87,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [1, 2],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-narrow-deer-path",
        randomValue: 0.92,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [0, 2],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-narrow-deer-path",
        randomValue: 0.97,
        eliminations: [
          {
            victimIndex: 2,
            killerIndices: [0, 1],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-use-third-as-decoy",
        randomValue: 0.75,
        eliminations: [
          {
            victimIndex: 2,
            killerIndices: [0],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-ravine-betrayal",
        randomValue: 0,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [0],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-ravine-betrayal",
        randomValue: 0.5,
        eliminations: [
          {
            victimIndex: 0,
            killerIndices: [],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-ravine-betrayal",
        randomValue: 0.75,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-ravine-betrayal",
        randomValue: 0.9,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [0],
          },
          {
            victimIndex: 2,
            killerIndices: [0],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-trio-ravine-betrayal",
        randomValue: 0.99,
        eliminations: [
          {
            victimIndex: 1,
            killerIndices: [],
          },
          {
            victimIndex: 0,
            killerIndices: [1],
          },
          {
            victimIndex: 2,
            killerIndices: [0],
          },
        ],
      },
      {
        definitionId: "bloodbath-flee-quartet-rope-bridge-chain-reaction",
        randomValue: 0,
        eliminations: [
          {
            victimIndex: 3,
            killerIndices: [],
          },
        ],
      },
    ] as const;

    for (const fatalCase of fatalCases) {
      const definition = requireDefinition(fatalCase.definitionId);
      const { resolution, participantsByRole } = resolveDefinition(
        definition,
        fatalCase.randomValue,
      );
      const participants = definition.roles.flatMap((role) => participantsByRole[role.id] ?? []);
      const eliminations = getEliminations(resolution.changes);
      const eliminationByVictimId = new Map(
        eliminations.map((change) => [change.tributeId, change]),
      );

      expect(eliminations).toHaveLength(fatalCase.eliminations.length);

      for (const expected of fatalCase.eliminations) {
        const victim = participants[expected.victimIndex];
        const killerTributeIds = expected.killerIndices.map(
          (killerIndex) => participants[killerIndex]?.id,
        );

        expect(victim).toBeDefined();
        expect(eliminationByVictimId.get(victim?.id ?? "")?.killerTributeIds).toEqual(
          killerTributeIds,
        );
      }
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
    const { resolution, participantsByRole } = resolveDefinition(
      requireDefinition("bloodbath-flee-break-away-crowd"),
      0.99,
    );
    const participantIds = Object.values(participantsByRole)
      .flat()
      .map((tribute) => tribute.id);
    const truceChanges = resolution.changes.flatMap((change) =>
      change.type === "form-truce" ? [change] : [],
    );
    const hiddenTributeIds = resolution.changes.flatMap((change) =>
      change.type === "apply-status" && change.status.definitionId === "hidden"
        ? [change.tributeId]
        : [],
    );

    expect(truceChanges).toHaveLength(1);
    expect(truceChanges[0]?.truce.tributeIds).toEqual(participantIds);
    expect(new Set(hiddenTributeIds)).toEqual(new Set(participantIds));
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

  it("marks every immediate-death-capable concept as fatal", () => {
    const fatalCapableIds = FLEE_EVENTS.filter((definition) =>
      definition.tags.includes("fatal"),
    ).map((definition) => definition.id);

    expect(new Set(fatalCapableIds)).toEqual(
      new Set([
        "bloodbath-flee-leap-across-creek",
        "bloodbath-flee-cross-fallen-tree",
        "bloodbath-flee-escape-stampede",
        "bloodbath-flee-pair-fallen-log-cooperation",
        "bloodbath-flee-pair-abandoned-at-creek",
        "bloodbath-flee-trio-narrow-deer-path",
        "bloodbath-flee-trio-use-third-as-decoy",
        "bloodbath-flee-trio-ravine-betrayal",
        "bloodbath-flee-quartet-rope-bridge-chain-reaction",
      ]),
    );
  });
});
