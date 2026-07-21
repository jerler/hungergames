import { describe, expect, it } from "vitest";

import { EVENT_CATALOGUE } from "~/game/events/catalogue/index";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import type { RandomSource } from "~/game/engine/random";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";
import { SURVIVAL_EVENTS } from "./survival-events";

const ROUND = {
  day: 1,
  period: "day",
} as const;

const BALANCED_STATS = {
  brains: 3,
  brawn: 3,
  luck: 3,
} satisfies TributeStats;

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
      seed: "survival-misadventure-tests",
      now: "2026-07-19T12:00:00.000Z",
    },
  );
}

function withStats(
  tribute: GameTribute,
  stats: TributeStats,
  name = tribute.snapshot.name,
): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      name,
      stats,
    },
  };
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

function requireEvent(eventId: string): EventDefinition {
  const definition = SURVIVAL_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing survival event "${eventId}".`);
  }

  return definition;
}

function resolveEvent(
  definition: EventDefinition,
  game: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
): EventResolution {
  return definition.resolve({
    state: game,
    round: ROUND,

    livingTributes: game.tributes.filter((tribute) => tribute.isAlive),

    eventId: `test:${definition.id}`,

    random: createSequenceRandom(randomValues),

    participantsByRole,
  });
}

function getAppliedStatuses(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "apply-status" ? [change.status] : [],
  );
}

function getAcquiredItemIds(resolution: EventResolution) {
  return resolution.changes.flatMap((change) =>
    change.type === "acquire-item" ? [change.item.definitionId] : [],
  );
}

describe("survival events", () => {
  it("includes every event in the main catalogue", () => {
    expect(SURVIVAL_EVENTS.every((event) => EVENT_CATALOGUE.includes(event))).toBe(true);
  });

  it("applies disoriented after a critical map failure", () => {
    const game = createTestGame();

    const tribute = withStats(game.tributes[0], BALANCED_STATS);

    const resolution = resolveEvent(
      requireEvent("upside-down-map"),
      game,
      {
        tribute: [tribute],
      },
      [0],
    );

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "disoriented",
        severity: 2,
      }),
    ]);
  });

  it("resolves picnic participants independently", () => {
    const game = createTestGame();

    const firstTribute = withStats(game.tributes[0], BALANCED_STATS, "Careful");

    const secondTribute = withStats(game.tributes[1], BALANCED_STATS, "Hungry");

    const resolution = resolveEvent(
      requireEvent("suspicious-picnic"),
      game,
      {
        tributes: [firstTribute, secondTribute],
      },
      [0.999, 0],
    );

    expect(getAcquiredItemIds(resolution)).toEqual(["food", "water"]);

    expect(getAppliedStatuses(resolution)).toEqual([
      expect.objectContaining({
        definitionId: "poisoned",
      }),
    ]);
  });

  it("makes a failed picnic participant sick", () => {
    const game = createTestGame();

    const firstTribute = withStats(game.tributes[0], BALANCED_STATS);

    const secondTribute = withStats(game.tributes[1], BALANCED_STATS);

    const resolution = resolveEvent(
      requireEvent("suspicious-picnic"),
      game,
      {
        tributes: [firstTribute, secondTribute],
      },
      [0.3, 0.3],
    );

    expect(getAppliedStatuses(resolution).map((status) => status.definitionId)).toEqual([
      "sick",
      "sick",
    ]);
  });
});
