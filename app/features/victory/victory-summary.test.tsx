import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute, VictoryOutcome } from "~/game/types/game-state";

import { VictorySummary } from "./victory-summary";

const FINAL_ROUND = {
  day: 3,
  period: "night",
} as const;

interface VictoryFixture {
  game: GameState;
  victors: GameTribute[];
}

function createVictoryFixture(kind: "sole" | "joint"): VictoryFixture {
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

        return `victory-summary-id-${nextId}`;
      },
      seed: "victory-summary-tests",
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
        portraitUrl: null,
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
    throw new Error("The victory fixture requires at least two tributes.");
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
    game: {
      ...initialGame,

      phase: "victory",
      currentRound: FINAL_ROUND,
      tributes,
      victoryOutcome,
    },

    victors: kind === "joint" ? [firstVictor, secondVictor] : [firstVictor],
  };
}

describe("VictorySummary", () => {
  it("renders a sole-victor summary and opens statistics", () => {
    const { game, victors } = createVictoryFixture("sole");

    const handleViewStatistics = vi.fn();

    render(
      <VictorySummary game={game} victors={victors} onViewStatistics={handleViewStatistics} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "The victor is...",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Julie")).toBeInTheDocument();

    expect(
      screen.getByText(
        `Julie is the sole survivor of a field of ${game.tributes.length} tributes.`,
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText("Nikita")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /View final statistics/i,
      }),
    );

    expect(handleViewStatistics).toHaveBeenCalledOnce();
  });

  it("renders both joint victors", () => {
    const { game, victors } = createVictoryFixture("joint");

    render(<VictorySummary game={game} victors={victors} onViewStatistics={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: "The victors are...",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Julie")).toBeInTheDocument();

    expect(screen.getByText("Nikita")).toBeInTheDocument();

    expect(
      screen.getByText("Julie and Nikita defied the Capitol and survived the Games together."),
    ).toBeInTheDocument();

    const victorCountByDistrict = new Map<number, number>();

    for (const victor of victors) {
      victorCountByDistrict.set(
        victor.district,
        (victorCountByDistrict.get(victor.district) ?? 0) + 1,
      );
    }

    for (const [district, victorCount] of victorCountByDistrict) {
      expect(screen.getAllByText(`District ${district}`)).toHaveLength(victorCount);
    }
  });
});
