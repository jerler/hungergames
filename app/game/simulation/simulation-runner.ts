import { createInitialGameState } from "~/game/engine/create-initial-game-state";

import { assertGameStateInvariants } from "~/game/engine/game-invariants";

import { createSeededRandom } from "~/game/engine/random";

import { getNextRound, getRoundSequence } from "~/game/engine/rounds";

import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";

import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";

import type { DistrictCount } from "~/game/types/game-config";

import { createDefaultGameConfig } from "~/game/types/game-config";

import type { GameState } from "~/game/types/game-state";
import {
  captureEventSelectionDiagnostics,
  type EventSelectionDiagnosticsSnapshot,
} from "~/game/simulation/event-selection-diagnostics";

import { gameReducer } from "~/state/game-reducer";

export interface SimulationRoundSnapshot {
  round: import("~/game/types/game-state").RoundReference;
  state: GameState;
}

export interface SimulationRun {
  seed: string;
  districtCount: DistrictCount;
  roundsCompleted: number;
  roundSnapshots: readonly SimulationRoundSnapshot[];
  state: GameState;
  selectionDiagnostics?: EventSelectionDiagnosticsSnapshot;
}

export interface SimulateGameOptions {
  seed: string;
  districtCount: DistrictCount;

  maxRounds?: number;
  createdAt?: string;
  captureSelectionDiagnostics?: boolean;
}

export interface SimulationBatchDefinition {
  seedPrefix: string;
  count: number;
  districtCount: DistrictCount;
  captureSelectionDiagnostics?: boolean;
}

function createSimulationGame({
  seed,
  districtCount,
  createdAt,
}: Required<Pick<SimulateGameOptions, "seed" | "districtCount" | "createdAt">>): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(
      districtCount,
      DEFAULT_TRIBUTES,
      createSeededRandom(`${seed}:reaping`),
    ),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `${seed}-id-${nextId}`;
      },

      now: createdAt,
      seed,
    },
  );
}

function requireGameState(state: GameState | null, message: string): GameState {
  if (!state) {
    throw new Error(message);
  }

  return state;
}

function getCompletedRoundCount(state: GameState): number {
  return Math.max(
    0,

    ...state.eventHistory.map((event) => getRoundSequence(event.round)),
  );
}

export function simulateGame({
  seed,
  districtCount,
  maxRounds = 100,
  createdAt = "2026-07-25T12:00:00.000Z",
  captureSelectionDiagnostics: shouldCaptureSelectionDiagnostics = false,
}: SimulateGameOptions): SimulationRun {
  if (shouldCaptureSelectionDiagnostics) {
    const { result, diagnostics } = captureEventSelectionDiagnostics(() =>
      simulateGame({
        seed,
        districtCount,
        maxRounds,
        createdAt,
        captureSelectionDiagnostics: false,
      }),
    );

    return {
      ...result,
      selectionDiagnostics: diagnostics,
    };
  }

  let state: GameState | null = createSimulationGame({
    seed,
    districtCount,
    createdAt,
  });

  assertGameStateInvariants(state);

  const roundSnapshots: SimulationRoundSnapshot[] = [];

  for (let roundIndex = 0; roundIndex < maxRounds; roundIndex += 1) {
    const nextRound = getNextRound(state.currentRound);

    roundSnapshots.push({
      round: nextRound,
      state,
    });
    state = requireGameState(
      gameReducer(state, {
        type: "round/began",

        now: `${seed}:round-${roundIndex}:start`,
      }),

      `Simulation "${seed}" lost its state while beginning a round.`,
    );

    assertGameStateInvariants(state);

    if (state.phase === "victory") {
      return {
        seed,
        districtCount,

        roundsCompleted: getCompletedRoundCount(state),
        roundSnapshots: [...roundSnapshots],

        state,
      };
    }

    state = requireGameState(
      gameReducer(state, {
        type: "round/revealed",

        now: `${seed}:round-${roundIndex}:end`,
      }),

      `Simulation "${seed}" lost its state while revealing a round.`,
    );

    assertGameStateInvariants(state);

    if (state.phase === "victory") {
      return {
        seed,
        districtCount,

        roundsCompleted: getCompletedRoundCount(state),
        roundSnapshots: [...roundSnapshots],

        state,
      };
    }
  }

  throw new Error(`Simulation "${seed}" failed to produce a victor within ${maxRounds} rounds.`);
}

export function simulateGameBatch(
  definitions: readonly SimulationBatchDefinition[],
): SimulationRun[] {
  return definitions.flatMap(
    ({ seedPrefix, count, districtCount, captureSelectionDiagnostics }) => {
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(
          `Simulation batch "${seedPrefix}" must contain a positive integer number of games.`,
        );
      }

      return Array.from(
        {
          length: count,
        },

        (_, index) =>
          simulateGame({
            seed: `${seedPrefix}-${index}`,

            districtCount,
            ...(captureSelectionDiagnostics !== undefined
              ? {
                  captureSelectionDiagnostics,
                }
              : {}),
          }),
      );
    },
  );
}
