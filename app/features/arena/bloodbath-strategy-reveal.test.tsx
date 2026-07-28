import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import type { GameTribute } from "~/game/types/game-state";

import { BloodbathStrategyReveal } from "./bloodbath-strategy-reveal";

function createTribute(id: string, name: string, district: number): GameTribute {
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
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("BloodbathStrategyReveal", () => {
  it("reveals the Cornucopia runners one at a time after a short delay", () => {
    vi.useFakeTimers();

    const handleContinue = vi.fn();

    render(
      <BloodbathStrategyReveal
        cornucopiaTributes={[
          createTribute("tribute-1", "Mothman", 1),
          createTribute("tribute-2", "Mario", 2),
        ]}
        totalTributeCount={4}
        onContinue={handleContinue}
        revealDelayMs={650}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Ran for the Cornucopia...",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText("Mothman")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(650);
    });

    const tributeList = screen.getByRole("list", {
      name: "Tributes who ran for the Cornucopia",
    });

    expect(within(tributeList).getByText("Mothman")).toBeInTheDocument();
    expect(within(tributeList).getByText("Mario")).toBeInTheDocument();

    const tributeItems = within(tributeList).getAllByRole("listitem");

    expect(tributeItems[0]).toHaveAttribute("data-reveal-index", "0");
    expect(tributeItems[0]).toHaveStyle({ animationDelay: "80ms" });
    expect(tributeItems[1]).toHaveAttribute("data-reveal-index", "1");
    expect(tributeItems[1]).toHaveStyle({ animationDelay: "190ms" });

    expect(screen.getByText("The remaining 2 tributes ran for the trees.")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continue to the Bloodbath",
      }),
    );

    expect(handleContinue).toHaveBeenCalledOnce();
  });
});
