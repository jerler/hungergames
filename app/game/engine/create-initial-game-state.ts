import { validateTributeDrafts } from "~/features/reaping/reaping-validation";
import type { TributeAssignmentMode } from "~/game/tributes/tribute-drafts";
import type { GameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute } from "~/game/types/game-state";
import type { TributeDraft } from "~/game/types/tribute";

interface CreateInitialGameStateOptions {
  createId?: () => string;
  now?: string;
  seed?: string;
}

function createUuid(): string {
  return crypto.randomUUID();
}

function createGameTribute(tribute: TributeDraft, createId: () => string): GameTribute {
  return {
    id: createId(),
    sourceDefinitionId: tribute.sourceDefinitionId,

    district: tribute.district,
    districtPosition: tribute.districtPosition,

    snapshot: {
      name: tribute.name.trim(),
      portraitUrl: tribute.portraitPreviewUrl,
      portraitPosition: tribute.portraitPosition,
      pronouns: tribute.pronouns,
      stats: {
        ...tribute.stats,
      },
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

export function createInitialGameState(
  config: GameConfig,
  tributes: readonly TributeDraft[],
  assignmentMode: TributeAssignmentMode,
  options: CreateInitialGameStateOptions = {},
): GameState {
  const validationResult = validateTributeDrafts(tributes, config.districtCount);

  if (!validationResult.isValid) {
    throw new Error("A Game cannot begin with an invalid tribute roster.");
  }

  const createId = options.createId ?? createUuid;
  const timestamp = options.now ?? new Date().toISOString();

  return {
    schemaVersion: 1,

    id: createId(),
    seed: options.seed ?? createId(),
    phase: "opening",
    assignmentMode,

    config: {
      ...config,
      giftFrequencies: {
        ...config.giftFrequencies,
      },
    },

    currentRound: null,

    tributes: tributes.map((tribute) => createGameTribute(tribute, createId)),

    roundEvents: [],
    revealedEventCount: 0,
    eventHistory: [],
    itemTransactions: [],

    victorTributeId: null,

    engine: {
      consecutiveNonEliminationRounds: 0,
      forcedResolutionCount: 0,
    },

    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
