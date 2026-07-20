import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, VictoryOutcome } from "~/game/types/game-state";

import { GameStatistics } from "./game-statistics";

const FINAL_ROUND = {
  day: 3,
  period: "night",
} as const;

function createCompletedGame(kind: "sole" | "joint"): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  const initialGame = createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;

        return `statistics-id-${nextId}`;
      },
      seed: "game-statistics-tests",
      now: "2026-07-20T12:00:00.000Z",
    },
  );

  const victorCount = kind === "joint" ? 2 : 1;

  const tributes = initialGame.tributes.map((tribute, index) => {
    const isVictor = index < victorCount;

    const name = index === 0 ? "Julie" : index === 1 ? "Nikita" : tribute.snapshot.name;

    return {
      ...tribute,

      snapshot: {
        ...tribute.snapshot,
        name,
      },

      isAlive: isVictor,

      death: isVictor
        ? null
        : {
            round: FINAL_ROUND,
            causeId: "test-elimination",
            causeLabel: "Test elimination",
            summary: `${name} was eliminated during test setup.`,
            killerTributeIds: [],
            resolvedEventId: `test-elimination-${index}`,
          },
    };
  });

  const firstVictor = tributes[0];

  const secondVictor = tributes[1];

  if (!firstVictor || !secondVictor) {
    throw new Error("The statistics fixture requires at least two tributes.");
  }

  const victoryOutcome: VictoryOutcome =
    kind === "joint"
      ? {
          kind: "joint",
          victorTributeIds: [firstVictor.id, secondVictor.id],
          sourceEventId: "poisonous-berries-finale",
          reason: "poisonous-berries",
        }
      : {
          kind: "sole",
          victorTributeIds: [firstVictor.id],
          sourceEventId: null,
        };

  return {
    ...initialGame,

    phase: "statistics",
    currentRound: FINAL_ROUND,
    tributes,
    victoryOutcome,
  };
}

describe("GameStatistics", () => {
  it("renders a sole-victory outcome", () => {
    const game = createCompletedGame("sole");

    const victor = game.tributes[0];

    if (!victor) {
      throw new Error("The statistics fixture has no victor.");
    }

    render(<GameStatistics game={game} />);

    expect(
      screen.getByRole("heading", {
        name: "Final statistics",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Sole victor")).toBeInTheDocument();

    expect(
      screen.getByText(`Julie emerged victorious from District ${victor.district}.`),
    ).toBeInTheDocument();

    expect(screen.queryByText("Joint victory")).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Deaths by round",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Night 3")).toBeInTheDocument();
  });

  it("renders a joint-victory outcome", () => {
    const game = createCompletedGame("joint");

    render(<GameStatistics game={game} />);

    expect(screen.getByText("Joint victory")).toBeInTheDocument();

    expect(
      screen.getByText(
        "Julie and Nikita were declared joint victors after defying the Capitol together.",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText("Sole victor")).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Deadliest tributes",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("No tribute was directly responsible for another tribute’s death."),
    ).toBeInTheDocument();
  });
});
