import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActiveTruceSummary } from "./active-truce-summary";
import type { GameTribute, Truce } from "~/game/types/game-state";

function createTribute(id: string, name: string, districtPosition: 1 | 2): GameTribute {
  return {
    id,
    sourceDefinitionId: null,
    district: 1,
    districtPosition,

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

describe("ActiveTruceSummary", () => {
  it("displays active members and expiry", () => {
    const tributes = [
      createTribute("tribute-1", "Avery Chen", 1),

      createTribute("tribute-2", "Blair Okafor", 2),
    ];

    const truce: Truce = {
      id: "truce-1",
      kind: "standard",

      tributeIds: tributes.map((tribute) => tribute.id),

      createdRound: {
        day: 1,
        period: "day",
      },

      expiresAfterRound: {
        day: 1,
        period: "night",
      },
    };

    render(<ActiveTruceSummary truces={[truce]} tributes={tributes} />);

    expect(
      screen.getByRole("heading", {
        name: "Active truces",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Avery Chen and Blair Okafor")).toBeInTheDocument();

    expect(screen.getByText("Temporary truce · through Night 1")).toBeInTheDocument();
  });

  it("renders nothing without active truces", () => {
    const { container } = render(<ActiveTruceSummary truces={[]} tributes={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
