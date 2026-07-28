import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

import { NightSummary } from "./night-summary";

function createStatus(
  definitionId: StatusEffect["definitionId"],
  severity: StatusEffect["severity"] = 1,
): StatusEffect {
  return {
    id: `status-${definitionId}`,
    definitionId,
    severity,
    remainingRounds: definitionId === "hungry" ? null : 2,
    sourceEventId: `event-${definitionId}`,
    sourceTributeId: null,
    appliedRound: {
      day: 2,
      period: "night",
    },
  };
}

function createTribute(
  id: string,
  name: string,
  district: number,
  overrides: Partial<GameTribute> = {},
): GameTribute {
  return {
    id,
    sourceDefinitionId: null,
    district,
    districtPosition: 1,
    snapshot: {
      name,
      pronouns: "they",
      portraitUrl: null,
      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    },
    isAlive: true,
    death: null,
    survival: createDefaultTributeSurvivalState(),
    statuses: [],
    inventory: [],
    allianceId: null,
    statistics: {
      kills: 0,
      attemptedKills: 0,
      giftsReceived: 0,
      eventsSurvived: 0,
    },
    ...overrides,
  };
}

function createFallenTribute(
  id: string,
  name: string,
  district: number,
  day: number,
  summary: string,
): GameTribute {
  return createTribute(id, name, district, {
    isAlive: false,
    death: {
      round: {
        day,
        period: "night",
      },
      causeId: "test-cause",
      causeLabel: "Test cause",
      summary,
      killerTributeIds: [],
      resolvedEventId: `event-${id}`,
    },
  });
}

describe("NightSummary", () => {
  it("shows portrait-only memorials, every survivor, and active statuses", () => {
    const handleContinue = vi.fn();

    render(
      <NightSummary
        day={2}
        tributes={[
          createFallenTribute(
            "fallen-today",
            "Mario",
            2,
            2,
            "Mario is swept away by the flooded river.",
          ),
          createFallenTribute(
            "fallen-yesterday",
            "Pennywise",
            4,
            1,
            "Pennywise fell during the Bloodbath.",
          ),
          createTribute("living-statuses", "Mothman", 1, {
            statuses: [createStatus("hungry"), createStatus("well-rested", 2)],
          }),
          createTribute("living-clear", "Severus Snape", 3),
        ]}
        continueLabel="Continue to Day 3"
        onContinue={handleContinue}
        soundEnabled={false}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "The Fallen and the Remaining",
      }),
    ).toBeInTheDocument();

    const fallenList = screen.getByRole("list", {
      name: "Tributes who died during Day 2",
    });

    expect(
      within(fallenList).getByRole("article", {
        name: "Mario, District 2",
      }),
    ).toBeInTheDocument();
    expect(within(fallenList).queryByText("Mario")).not.toBeInTheDocument();
    expect(
      within(fallenList).queryByText("Mario is swept away by the flooded river."),
    ).not.toBeInTheDocument();
    expect(
      within(fallenList).queryByRole("article", {
        name: "Pennywise, District 4",
      }),
    ).not.toBeInTheDocument();

    const livingList = screen.getByRole("list", {
      name: "Tributes alive after Night 2",
    });

    expect(within(livingList).getByText("Mothman")).toBeInTheDocument();
    expect(within(livingList).getByText("Severus Snape")).toBeInTheDocument();
    expect(within(livingList).getByText("Hungry")).toBeInTheDocument();
    expect(within(livingList).getByText("Well Rested")).toBeInTheDocument();
    expect(within(livingList).getByText("No active statuses")).toBeInTheDocument();

    const fallenItem = within(fallenList).getByRole("listitem");
    expect(fallenItem).toHaveAttribute("data-reveal-index", "0");
    expect(fallenItem).toHaveStyle({
      animationDelay: "260ms",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continue to Day 3",
      }),
    );

    expect(handleContinue).toHaveBeenCalledOnce();
  });

  it("shows a no-deaths message when every tribute survives the day", () => {
    render(
      <NightSummary
        day={3}
        tributes={[createTribute("living", "Mothman", 1)]}
        continueLabel="Continue to Day 4"
        onContinue={() => undefined}
        soundEnabled={false}
      />,
    );

    expect(screen.getByText("No cannon sounded today.")).toBeInTheDocument();
    expect(screen.getByText("0 cannons sounded")).toBeInTheDocument();
  });
});
