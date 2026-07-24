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
  it("allows the reveal to be skipped", () => {
    const handleComplete = vi.fn();

    render(<VictoryFanfare victors={[victor]} onComplete={handleComplete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Skip reveal",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "We have a victor",
      }),
    ).toBeInTheDocument();
    expect(handleComplete).toHaveBeenCalledOnce();
  });

  it("announces two joint victors", () => {
    render(<VictoryFanfare victors={[victor, secondVictor]} onComplete={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: "We have victors",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Julie and Nikita")).toBeInTheDocument();

    expect(screen.getByText("District 4 • District 7")).toBeInTheDocument();
  });
});
