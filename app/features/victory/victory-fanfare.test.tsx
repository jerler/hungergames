import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GameTribute } from "~/game/types/game-state";

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

describe("VictoryFanfare", () => {
  it("allows the reveal to be skipped", () => {
    const handleComplete = vi.fn();

    render(<VictoryFanfare victor={victor} onComplete={handleComplete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Skip reveal",
      }),
    );

    expect(handleComplete).toHaveBeenCalledOnce();
  });
});
