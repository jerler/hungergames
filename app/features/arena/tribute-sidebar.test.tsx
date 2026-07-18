import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GameTribute } from "~/game/types/game-state";

import { TributeSidebar } from "./tribute-sidebar";

function createTribute(overrides: Partial<GameTribute>): GameTribute {
  return {
    id: "tribute-1",
    sourceDefinitionId: null,
    district: 1,
    districtPosition: 1,

    snapshot: {
      name: "Avery Chen",
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

    ...overrides,
  };
}

describe("TributeSidebar", () => {
  it("displays living tribute count", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({}),
          createTribute({
            id: "tribute-2",
            districtPosition: 2,
            snapshot: {
              name: "Blair Okafor",
              portraitUrl: null,
              stats: {
                brains: 3,
                brawn: 3,
                luck: 3,
              },
            },
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "2 remaining",
      }),
    ).toBeInTheDocument();
  });

  it("shows the death round and cause", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            isAlive: false,
            death: {
              round: {
                day: 2,
                period: "night",
              },
              causeId: "freezing-night",
              causeLabel: "Froze",
              summary: "Avery froze.",
              killerTributeIds: [],
              resolvedEventId: "event-1",
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Night 2")).toBeInTheDocument();

    expect(screen.getByText("Froze")).toBeInTheDocument();
  });
});
