import type { PronounSetId } from "~/game/tributes/pronouns";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { ItemDefinitionId } from "~/game/items/item-schema";

export const AUTHORING_TEST_ROUND = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

interface TestTributeOptions {
  id?: string;
  name?: string;
  pronouns?: PronounSetId;
  stats?: TributeStats;
}

export function createAuthoringTestTribute({
  id = "tribute-1",
  name = "Test Tribute",
  pronouns = "they",
  stats = {
    brains: 3,
    brawn: 3,
    luck: 3,
  },
}: TestTributeOptions = {}): GameTribute {
  return {
    id,

    sourceDefinitionId: null,

    district: 1,

    districtPosition: 1,

    snapshot: {
      name,
      pronouns,
      portraitUrl: null,
      stats,
    },

    isAlive: true,

    death: null,

    statuses: [],

    inventory: [],

    allianceId: null,

    statistics: {
      kills: 0,
      attemptedKills: 0,
      giftsReceived: 0,
      eventsSurvived: 0,
    },
  };
}

export function createAuthoringTestGame(
  tributes: readonly GameTribute[] = [createAuthoringTestTribute()],
): GameState {
  return {
    schemaVersion: 1,

    id: "authoring-test-game",

    seed: "authoring-test-seed",

    phase: "round-events",

    assignmentMode: "manual",

    config: createDefaultGameConfig(),

    currentRound: AUTHORING_TEST_ROUND,

    tributes: [...tributes],

    truces: [],

    vendettas: [],

    roundEvents: [],

    revealedEventCount: 0,

    eventHistory: [],

    itemTransactions: [],

    victoryOutcome: null,

    engine: {
      consecutiveNonEliminationRounds: 0,

      forcedResolutionCount: 0,
    },

    createdAt: "2026-07-22T12:00:00.000Z",

    updatedAt: "2026-07-22T12:00:00.000Z",
  };
}

interface AuthoringTestItemOptions {
  eventId?: string;
  round?: RoundReference;
  usesRemaining?: number | null;
}

export function withAuthoringTestItem(
  tribute: GameTribute,
  itemId: ItemDefinitionId,
  {
    eventId = ["authoring-fixture", tribute.id, tribute.inventory.length, itemId].join(":"),
    round = AUTHORING_TEST_ROUND,
    usesRemaining,
  }: AuthoringTestItemOptions = {},
): GameTribute {
  const item = createInventoryItemInstance(eventId, tribute.id, itemId, round);

  return {
    ...tribute,

    inventory: [
      ...tribute.inventory,

      usesRemaining === undefined
        ? item
        : {
            ...item,
            usesRemaining,
          },
    ],
  };
}
