import { describe, expect, it } from "vitest";

import { sequenceBloodbathEvents } from "~/game/bloodbath/bloodbath-sequencer";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom } from "~/game/engine/random";
import {
  CORNUCOPIA_EVENTS,
  CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  CORNUCOPIA_NONFATAL_INTERACTION_EVENTS,
  CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
  CORNUCOPIA_NONFATAL_TRIO_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import type { EventDefinition, ParticipantsByRole } from "~/game/events/event-schema";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

function createTestGame(seed = "cornucopia-flavour-events"): GameState {
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
  let offset = 0;
  const participantsByRole: Record<string, readonly GameTribute[]> = {};

  for (const role of definition.roles) {
    const participants = tributes.slice(offset, offset + role.count);

    if (participants.length !== role.count) {
      throw new Error(
        `Not enough deterministic participants for role "${role.id}" in "${definition.id}".`,
      );
    }

    participantsByRole[role.id] = participants;
    offset += role.count;
  }

  return participantsByRole;
}

function resolveDefinition(
  state: GameState,
  definition: EventDefinition,
  participantsByRole: ParticipantsByRole,
): void {
  const eventId = `test:${definition.id}`;
  const resolution = definition.resolve({
    state,
    round: DAY_ONE,
    livingTributes: state.tributes,
    eventId,
    random: createSeededRandom(eventId),
    participantsByRole,
    unavailableItemInstanceIds: new Set<string>(),
  });

  validateEventResolution({
    eventId,
    definitionId: definition.id,
    round: DAY_ONE,
    resolution,
  });

  expect(resolution.text.trim().length).toBeGreaterThan(0);
  expect(resolution.changes.some((change) => change.type === "eliminate-tribute")).toBe(false);
}

describe("imported non-fatal Cornucopia events", () => {
  it("registers every imported event in the Bloodbath catalogue", () => {
    const catalogueIds = new Set(CORNUCOPIA_EVENTS.map((definition) => definition.id));
    const importedDefinitions = [
      ...CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
      ...CORNUCOPIA_NONFATAL_INTERACTION_EVENTS,
    ];

    expect(importedDefinitions).toHaveLength(51);
    expect(new Set(importedDefinitions.map((definition) => definition.id)).size).toBe(
      importedDefinitions.length,
    );

    for (const definition of importedDefinitions) {
      expect(catalogueIds.has(definition.id)).toBe(true);
      expect(definition.category).not.toBe("fatal");
    }
  });

  it("resolves every solo acquisition without creating a fatality", () => {
    const state = createTestGame("solo-flavour-resolution");
    const tribute = state.tributes[0];

    if (!tribute) {
      throw new Error("Expected a tribute for solo Cornucopia tests.");
    }

    for (const definition of CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS) {
      resolveDefinition(state, definition, {
        tribute: [tribute],
      });
    }
  });

  it("resolves every pair interaction without creating a fatality", () => {
    const state = createTestGame("pair-flavour-resolution");
    const [actor, target] = state.tributes;

    if (!actor || !target) {
      throw new Error("Expected two tributes for pair Cornucopia tests.");
    }

    for (const definition of CORNUCOPIA_NONFATAL_PAIR_EVENTS) {
      resolveDefinition(state, definition, {
        actor: [actor],
        target: [target],
      });
    }
  });

  it("resolves the group interactions", () => {
    const state = createTestGame("group-flavour-resolution");
    const trio = state.tributes.slice(0, 3);
    const quartet = state.tributes.slice(0, 4);

    for (const definition of CORNUCOPIA_NONFATAL_TRIO_EVENTS) {
      resolveDefinition(state, definition, createParticipantsByRole(definition, trio));
    }

    for (const definition of CORNUCOPIA_NONFATAL_QUARTET_EVENTS) {
      resolveDefinition(state, definition, createParticipantsByRole(definition, quartet));
    }
  });

  it("allows the sequencer to select post-target interaction events", () => {
    const interactionIds = new Set(
      CORNUCOPIA_NONFATAL_INTERACTION_EVENTS.map((definition) => definition.id),
    );
    const selectedInteractionIds = new Set<string>();

    for (let index = 0; index < 250; index += 1) {
      const state = createTestGame(`sequenced-flavour-${index}`);
      const events = sequenceBloodbathEvents(state, DAY_ONE);

      for (const event of events) {
        if (interactionIds.has(event.definitionId)) {
          selectedInteractionIds.add(event.definitionId);
        }
      }
    }

    expect(selectedInteractionIds.size).toBeGreaterThan(0);
  });
});
