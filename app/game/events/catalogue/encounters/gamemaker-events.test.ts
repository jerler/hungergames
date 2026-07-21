import { describe, expect, it } from "vitest";

import type { EventDefinition, ParticipantsByRole } from "~/game/events/event-schema";
import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";
import { GAMEMAKER_EVENTS } from "./gamemaker-events";

const ROUND = {
  day: 1,
  period: "day",
} as const;

function createTestGame(): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `test-id-${nextId}`;
      },
      seed: "luck-event-tests",
      now: "2026-07-19T12:00:00.000Z",
    },
  );
}

function withLuck(tribute: GameTribute, luck: TributeStatValue, name: string): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      name,
      stats: {
        ...tribute.snapshot.stats,
        luck,
      },
    },
  };
}

function requireGamemakerEvent(eventId: string): EventDefinition {
  const event = GAMEMAKER_EVENTS.find((candidate) => candidate.id === eventId);

  if (!event) {
    throw new Error(`Missing Gamemaker event "${eventId}".`);
  }

  return event;
}

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values[values.length - 1] ?? 0.5;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;

    return value;
  };
}

function resolveEvent(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
) {
  const livingTributes = Object.values(participantsByRole).flat();

  return definition.resolve({
    state: game,
    round: ROUND,
    livingTributes,
    eventId: `test:${definition.id}`,
    random: createSequenceRandom(randomValues),
    participantsByRole,
  });
}

describe("Gamemaker events", () => {
  it("includes every Gamemaker event in the main catalogue", () => {
    expect(GAMEMAKER_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });

  it("resolves each prize-crate participant independently", () => {
    const game = createTestGame();

    const luckyTribute = withLuck(game.tributes[0], 5, "Fortuna");

    const unluckyTribute = withLuck(game.tributes[1], 1, "Murphy");

    const resolution = resolveEvent(
      requireGamemakerEvent("capitol-prize-crate"),
      game,
      {
        tributes: [luckyTribute, unluckyTribute],
      },
      [0.6, 0.05, 0],
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",
        tributeId: luckyTribute.id,
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: unluckyTribute.id,
        status: expect.objectContaining({
          definitionId: "injured",
        }),
      }),
    );
  });
});
