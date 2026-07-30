import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, ParticipantsByRole } from "~/game/events/event-schema";
import { getEventParticipantShape } from "~/game/events/event-participant-shape";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import type { GameChange, GameState, GameTribute } from "~/game/types/game-state";
import {
  MULTI_PARTICIPANT_FLEE_EVENTS,
  PAIR_FLEE_EVENTS,
  QUARTET_FLEE_EVENTS,
  TRIO_FLEE_EVENTS,
} from "./flee-multi-events";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const REPRESENTATIVE_RANDOM_VALUES = [
  0, 0.06, 0.12, 0.2, 0.3, 0.4, 0.5, 0.65, 0.75, 0.82, 0.87, 0.92, 0.97, 0.99,
] as const;

function createTributes(): GameTribute[] {
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
  const tributes = createTributes();
  const state: GameState = {
    ...createAuthoringTestGame(tributes),
    currentRound: DAY_ONE,
  };
  const eventId = `test:${definition.id}:${randomValue}`;
  const participantsByRole = createParticipantsByRole(definition, tributes);
  const resolution = definition.resolve({
    state,
    round: DAY_ONE,
    livingTributes: tributes,
    eventId,
    random: () => randomValue,
    participantsByRole,
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
    tributes,
    participantsByRole,
  };
}

function requireMultiDefinition(id: string): EventDefinition {
  const definition = MULTI_PARTICIPANT_FLEE_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing multi-participant flee event "${id}".`);
  }

  return definition;
}

function getEliminations(changes: readonly GameChange[]) {
  return changes.filter((change) => change.type === "eliminate-tribute");
}

describe("multi-participant Bloodbath flee events", () => {
  it("adds eight pairs, six trios, and three quartets", () => {
    expect(PAIR_FLEE_EVENTS).toHaveLength(8);
    expect(TRIO_FLEE_EVENTS).toHaveLength(6);
    expect(QUARTET_FLEE_EVENTS).toHaveLength(3);
    expect(MULTI_PARTICIPANT_FLEE_EVENTS).toHaveLength(17);

    expect(new Set(MULTI_PARTICIPANT_FLEE_EVENTS.map((definition) => definition.id)).size).toBe(17);

    expect(
      PAIR_FLEE_EVENTS.every((definition) => getEventParticipantShape(definition) === "pair"),
    ).toBe(true);
    expect(
      TRIO_FLEE_EVENTS.every((definition) => getEventParticipantShape(definition) === "trio"),
    ).toBe(true);
    expect(
      QUARTET_FLEE_EVENTS.every(
        (definition) => getEventParticipantShape(definition) === "group-four-plus",
      ),
    ).toBe(true);
  });

  it("resolves every revised event across its authored branches", () => {
    for (const definition of MULTI_PARTICIPANT_FLEE_EVENTS) {
      for (const randomValue of REPRESENTATIVE_RANDOM_VALUES) {
        const { resolution } = resolveDefinition(definition, randomValue);

        expect(resolution.text.trim()).not.toBe("");
        expect(resolution.changes.some((change) => change.type === "acquire-item")).toBe(false);
      }
    }
  });

  it("marks every immediate-death-capable multi-participant event as fatal", () => {
    expect(
      MULTI_PARTICIPANT_FLEE_EVENTS.filter((definition) => definition.tags.includes("fatal")).map(
        (definition) => definition.id,
      ),
    ).toEqual([
      "bloodbath-flee-pair-fallen-log-cooperation",
      "bloodbath-flee-pair-abandoned-at-creek",
      "bloodbath-flee-trio-narrow-deer-path",
      "bloodbath-flee-trio-use-third-as-decoy",
      "bloodbath-flee-trio-ravine-betrayal",
      "bloodbath-flee-quartet-rope-bridge-chain-reaction",
    ]);
  });

  it("credits intentional pair and trio fatalities correctly", () => {
    const fallenLog = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-pair-fallen-log-cooperation"),
      0.3,
    );
    const creek = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-pair-abandoned-at-creek"),
      0,
    );
    const thornDuo = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-trio-narrow-deer-path"),
      0.87,
    );
    const clothesline = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-trio-use-third-as-decoy"),
      0.75,
    );

    expect(getEliminations(fallenLog.resolution.changes)[0]?.killerTributeIds).toEqual([
      fallenLog.tributes[1]?.id,
    ]);
    expect(getEliminations(creek.resolution.changes)[0]?.killerTributeIds).toEqual([
      creek.tributes[0]?.id,
    ]);
    expect(getEliminations(thornDuo.resolution.changes)[0]?.killerTributeIds).toEqual([
      thornDuo.tributes[1]?.id,
      thornDuo.tributes[2]?.id,
    ]);
    expect(getEliminations(clothesline.resolution.changes)[0]?.killerTributeIds).toEqual([
      clothesline.tributes[0]?.id,
    ]);
  });

  it("supports the revised multi-death ravine branches", () => {
    const bloodthirsty = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-trio-ravine-betrayal"),
      0.9,
    );
    const domino = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-trio-ravine-betrayal"),
      0.99,
    );
    const bloodthirstyEliminations = getEliminations(bloodthirsty.resolution.changes);
    const dominoEliminations = getEliminations(domino.resolution.changes);

    expect(bloodthirstyEliminations).toHaveLength(2);
    expect(
      bloodthirstyEliminations.every(
        (change) => change.killerTributeIds[0] === bloodthirsty.tributes[0]?.id,
      ),
    ).toBe(true);

    expect(dominoEliminations).toHaveLength(3);
    expect(dominoEliminations.map((change) => change.killerTributeIds)).toEqual([
      [],
      [domino.tributes[1]?.id],
      [domino.tributes[0]?.id],
    ]);
  });

  it("creates the revised truces and creek vendetta", () => {
    const decoyRegroup = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-pair-decoy-shout"),
      0.5,
    ).resolution;
    const creekAbandonment = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-pair-abandoned-at-creek"),
      0.8,
    ).resolution;
    const untrampled = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-trio-redirect-pursuit"),
      0.5,
    ).resolution;
    const splitPairs = resolveDefinition(
      requireMultiDefinition("bloodbath-flee-quartet-competing-pairs"),
      0.7,
    ).resolution;

    expect(decoyRegroup.changes.filter((change) => change.type === "form-truce")).toHaveLength(1);
    expect(
      creekAbandonment.changes.filter((change) => change.type === "form-vendetta"),
    ).toHaveLength(1);
    expect(untrampled.changes.filter((change) => change.type === "form-truce")).toHaveLength(1);
    expect(splitPairs.changes.filter((change) => change.type === "form-truce")).toHaveLength(2);
  });
});
