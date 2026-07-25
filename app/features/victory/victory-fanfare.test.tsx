import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameTribute } from "~/game/types/game-state";
import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";

import { VictoryFanfare } from "./victory-fanfare";

const victor: GameTribute = {
  id: "victor",
  sourceDefinitionId: null,
  district: 4,
  districtPosition: 1,

  snapshot: {
    name: "Julie",
    pronouns: "she",
    portraitUrl: null,
    stats: {
      brains: 5,
      brawn: 2,
      luck: 4,
    },
  },

  isAlive: true,
  death: null,
  survival: createDefaultTributeSurvivalState(),
  statuses: [],
  inventory: [],
  allianceId: null,

  statistics: {
    kills: 2,
    attemptedKills: 0,
    giftsReceived: 0,
    eventsSurvived: 4,
  },
};

const secondVictor: GameTribute = {
  ...victor,

  id: "second-victor",
  district: 7,

  snapshot: {
    ...victor.snapshot,
    name: "Nikita",
  },
};

describe("VictoryFanfare", () => {
  it("presents a full sole-victor ceremony and allows it to be skipped", () => {
    const handleComplete = vi.fn();

    render(<VictoryFanfare victors={[victor]} tributeCount={12} onComplete={handleComplete} />);

    expect(
      screen.getByRole("heading", {
        name: "The Games have a victor",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("The final cannon has sounded")).toBeInTheDocument();
    expect(screen.getByText("From 12 tributes, one remains.")).toBeInTheDocument();
    expect(screen.getByText("Julie")).toBeInTheDocument();
    expect(screen.getByText("District 4")).toBeInTheDocument();
    expect(screen.getByText("Long may Julie be remembered across Panem.")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Skip ceremony",
      }),
    );

    expect(handleComplete).toHaveBeenCalledOnce();
  });

  it("announces two joint victors as a Capitol-defying result", () => {
    render(
      <VictoryFanfare victors={[victor, secondVictor]} tributeCount={24} onComplete={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "The Games have victors",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("From 24 tributes, two defied the arena.")).toBeInTheDocument();
    expect(screen.getByText("Julie and Nikita")).toBeInTheDocument();
    expect(screen.getByText("District 4 • District 7")).toBeInTheDocument();
    expect(
      screen.getByText("The Capitol demanded one survivor. The arena answered with two."),
    ).toBeInTheDocument();
  });
});
