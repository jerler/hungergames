import { describe, expect, it } from "vitest";

import { sequenceBloodbathEvents } from "~/game/bloodbath/bloodbath-sequencer";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom } from "~/game/engine/random";
import {
  CORNUCOPIA_EVENTS,
  CORNUCOPIA_FATAL_BLOODBATH_EVENTS,
  CORNUCOPIA_FATAL_DELAYED_EVENTS,
  CORNUCOPIA_FATAL_TARGET_PROFILES,
} from "~/game/events/catalogue/bloodbath";
import type { EventDefinition, ParticipantsByRole } from "~/game/events/event-schema";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameChange, GameState, GameTribute } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

function createTestGame(seed = "cornucopia-fatal-events"): GameState {
  let nextId = 0;
  const game = createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, createSeededRandom(`${seed}:reaping`)),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `${seed}-id-${nextId}`;
      },
      seed,
      now: "2026-07-26T12:00:00.000Z",
    },
  );

  return {
    ...game,
    tributes: game.tributes.map((tribute): GameTribute => ({
      ...tribute,
      snapshot: {
        ...tribute.snapshot,
        stats: {
          brains: 5,
          brawn: 5,
          luck: 5,
        },
      },
    })),
  };
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

function resolveDefinition(state: GameState, definition: EventDefinition, randomValue = 0.73) {
  const eventId = `test:${definition.id}`;
  const resolution = definition.resolve({
    state,
    round: DAY_ONE,
    livingTributes: state.tributes,
    eventId,
    random: () => randomValue,
    participantsByRole: createParticipantsByRole(definition, state.tributes),
    unavailableItemInstanceIds: new Set<string>(),
  });

  validateEventResolution({
    eventId,
    definitionId: definition.id,
    round: DAY_ONE,
    resolution,
  });

  return resolution;
}

function getEliminations(changes: readonly GameChange[]) {
  return changes.filter((change) => change.type === "eliminate-tribute");
}

function getAcquisitions(changes: readonly GameChange[]) {
  return changes.filter((change) => change.type === "acquire-item");
}

function getStatuses(changes: readonly GameChange[]) {
  return changes.flatMap((change) => (change.type === "apply-status" ? [change.status] : []));
}

function requireDefinition(eventId: string): EventDefinition {
  const definition = CORNUCOPIA_FATAL_BLOODBATH_EVENTS.find(
    (candidate) => candidate.id === eventId,
  );

  if (!definition) {
    throw new Error(`Missing fatal Bloodbath event "${eventId}".`);
  }

  return definition;
}

describe("authored fatal Bloodbath events", () => {
  it("registers all immediate and delayed variants exactly once", () => {
    const catalogueIds = new Set(CORNUCOPIA_EVENTS.map((definition) => definition.id));
    const authoredIds = CORNUCOPIA_FATAL_BLOODBATH_EVENTS.map((definition) => definition.id);

    expect(CORNUCOPIA_FATAL_TARGET_PROFILES).toHaveLength(38);
    expect(CORNUCOPIA_FATAL_DELAYED_EVENTS).toHaveLength(2);
    expect(authoredIds).toHaveLength(40);
    expect(new Set(authoredIds).size).toBe(authoredIds.length);

    for (const eventId of authoredIds) {
      expect(catalogueIds.has(eventId)).toBe(true);
    }
  });

  it("resolves every target event within its declared fatality range", () => {
    const state = createTestGame("fatal-profile-resolution");

    for (const profile of CORNUCOPIA_FATAL_TARGET_PROFILES) {
      const resolution = resolveDefinition(state, profile.definition);
      const eliminationCount = getEliminations(resolution.changes).length;

      expect(eliminationCount).toBeGreaterThanOrEqual(profile.minImmediateEliminations);
      expect(eliminationCount).toBeLessThanOrEqual(profile.maxImmediateEliminations);
    }
  });

  it("makes podium fatalities rare and mutually exclusive", () => {
    const bitsDefinition = requireDefinition("cornucopia-fatal-podium-detonation-bits");
    const balloonDefinition = requireDefinition("cornucopia-fatal-podium-detonation-balloon");
    const baseState = createTestGame("podium-rarity");

    expect(bitsDefinition.baseWeight).toBe(0.15);
    expect(balloonDefinition.baseWeight).toBe(0.15);

    let eligibleGameCount = 0;

    for (let index = 0; index < 2_000; index += 1) {
      const state = {
        ...baseState,
        seed: `podium-rarity-${index}`,
      };
      const context = {
        state,
        round: DAY_ONE,
        livingTributes: state.tributes,
      };

      const bitsEligible = bitsDefinition.isEligible?.(context) ?? true;
      const balloonEligible = balloonDefinition.isEligible?.(context) ?? true;

      expect(bitsEligible && balloonEligible).toBe(false);

      if (bitsEligible || balloonEligible) {
        eligibleGameCount += 1;
      }
    }

    expect(eligibleGameCount).toBeGreaterThan(100);
    expect(eligibleGameCount).toBeLessThan(220);
  });

  it("makes exactly two seeded efficient trio fatalities eligible in every game", () => {
    const efficientTrioEventIds = [
      "cornucopia-fatal-three-way-fight",
      "cornucopia-fatal-double-cherry-bomb",
      "cornucopia-fatal-supply-net-counterweight",
      "cornucopia-fatal-weapon-rack-chain-reaction",
    ] as const;
    const observedIds = new Set<string>();
    const baseState = createTestGame("efficient-trio-variety");

    for (let index = 0; index < 500; index += 1) {
      const state = {
        ...baseState,
        seed: `efficient-trio-slot-${index}`,
      };
      const context = {
        state,
        round: DAY_ONE,
        livingTributes: state.tributes,
      };
      const eligibleIds = efficientTrioEventIds.filter((eventId) => {
        const definition = requireDefinition(eventId);

        return definition.isEligible?.(context) ?? true;
      });

      expect(eligibleIds).toHaveLength(2);

      for (const eventId of eligibleIds) {
        observedIds.add(eventId);
      }
    }

    expect(observedIds).toEqual(new Set(efficientTrioEventIds));
  });

  it("keeps temporary Bloodbath props out of persistent inventory", () => {
    const state = createTestGame("scene-prop-resolution");
    const scenePropEventIds = [
      "cornucopia-fatal-thrown-knife-chest",
      "cornucopia-fatal-cherry-bomb-attack",
      "cornucopia-fatal-killed-while-fleeing",
      "cornucopia-fatal-improvised-branch-stabbing",
      "cornucopia-fatal-double-cherry-bomb",
    ];

    for (const eventId of scenePropEventIds) {
      const resolution = resolveDefinition(state, requireDefinition(eventId));

      expect(getAcquisitions(resolution.changes)).toHaveLength(0);
    }
  });

  it("persists only weapons and supplies carried away from the scene", () => {
    const state = createTestGame("persistent-reward-resolution");
    const expectedDefinitionIds = new Map<string, readonly string[]>([
      ["cornucopia-fatal-arrow-through-head", ["bow"]],
      ["cornucopia-fatal-spear-abdomen", ["spear"]],
      ["cornucopia-fatal-mercy-killing", ["knife"]],
      ["cornucopia-fatal-cliffside-knife-fight", ["knife"]],
      ["cornucopia-fatal-poisoned-blow-dart", ["blowgun"]],
    ]);

    for (const [eventId, expectedItemIds] of expectedDefinitionIds) {
      const resolution = resolveDefinition(state, requireDefinition(eventId));
      const acquiredItemIds = getAcquisitions(resolution.changes).map(
        (change) => change.item.definitionId,
      );

      expect(acquiredItemIds).toEqual(expect.arrayContaining([...expectedItemIds]));
    }
  });

  it("uses delayed status mechanics instead of immediate deaths", () => {
    const state = createTestGame("delayed-fatal-resolution");
    const bleedingResolution = resolveDefinition(
      state,
      requireDefinition("cornucopia-fatal-left-bleeding"),
    );

    expect(getEliminations(bleedingResolution.changes)).toHaveLength(0);
    expect(
      getStatuses(bleedingResolution.changes).some(
        (status) =>
          status.definitionId === "bleeding" && status.sourceTributeId === state.tributes[0]?.id,
      ),
    ).toBe(true);

    const poisonDefinition = requireDefinition("cornucopia-fatal-poisoned-blow-dart");
    const selfPoisonResolution = resolveDefinition(state, poisonDefinition, 0);
    const selfPoison = getStatuses(selfPoisonResolution.changes).find(
      (status) => status.definitionId === "poisoned",
    );

    expect(getEliminations(selfPoisonResolution.changes)).toHaveLength(0);
    expect(selfPoison?.sourceTributeId).toBeNull();
  });

  it("allows the sequencer to select authored fatal events", () => {
    const authoredIds = new Set(
      CORNUCOPIA_FATAL_BLOODBATH_EVENTS.map((definition) => definition.id),
    );
    const selectedIds = new Set<string>();

    for (let index = 0; index < 250; index += 1) {
      const state = createTestGame(`sequenced-fatal-${index}`);
      const events = sequenceBloodbathEvents(state, DAY_ONE);

      for (const event of events) {
        if (authoredIds.has(event.definitionId)) {
          selectedIds.add(event.definitionId);
        }
      }
    }

    expect(selectedIds.size).toBeGreaterThan(0);
  });

  it("ensures authored-event survivors received provisions through their first appearance", () => {
    const authoredIds = new Set(
      CORNUCOPIA_FATAL_BLOODBATH_EVENTS.map((definition) => definition.id),
    );
    let inspectedSurvivorCount = 0;
    let inspectedRepeatedSurvivorCount = 0;

    for (let index = 0; index < 100; index += 1) {
      const state = createTestGame(`fatal-provisions-${index}`);
      const events = sequenceBloodbathEvents(state, DAY_ONE);
      const provisionedTributeIds = new Set<string>();

      for (const event of events) {
        for (const change of event.changes) {
          if (
            change.type === "acquire-item" &&
            change.item.definitionId === "cornucopia-provisions"
          ) {
            provisionedTributeIds.add(change.tributeId);
          }
        }

        if (!authoredIds.has(event.definitionId)) {
          continue;
        }

        const eliminatedIds = new Set(
          getEliminations(event.changes).map((change) => change.tributeId),
        );

        for (const tributeId of event.participantTributeIds) {
          if (eliminatedIds.has(tributeId)) {
            continue;
          }

          inspectedSurvivorCount += 1;

          const receivesProvisionsInThisEvent = event.changes.some(
            (change) =>
              change.type === "acquire-item" &&
              change.tributeId === tributeId &&
              change.item.definitionId === "cornucopia-provisions",
          );

          if (!receivesProvisionsInThisEvent) {
            inspectedRepeatedSurvivorCount += 1;
          }

          expect(provisionedTributeIds.has(tributeId)).toBe(true);
        }
      }
    }

    expect(inspectedSurvivorCount).toBeGreaterThan(0);
    expect(inspectedRepeatedSurvivorCount).toBeGreaterThan(0);
  });
});
