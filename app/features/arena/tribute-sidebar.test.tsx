import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
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
      pronouns: "she",
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
              pronouns: "she",
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

    const deathBar = screen.getByRole("button", {
      name: "Froze. Avery froze.",
    });

    expect(deathBar).toHaveTextContent("Night 2");

    expect(deathBar).toHaveTextContent("Froze");
  });

  it("shows status urgency and fatality details", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [
              {
                id: "status-1",
                definitionId: "bleeding",
                severity: 2,
                remainingRounds: 1,
                sourceEventId: "deep-cut",
                appliedRound: {
                  day: 2,
                  period: "day",
                },
              },
            ],
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Bleeding. Fatal at the end " + "of the next round if untreated.",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("An untreated wound steadily weakens the tribute."),
    ).toBeInTheDocument();

    expect(screen.getByText("Received during Day 2.")).toBeInTheDocument();
  });

  it("shows the death summary and killer", () => {
    const killer = createTribute({
      id: "tribute-2",
      districtPosition: 2,
      snapshot: {
        name: "The Babadook",
        pronouns: "they",
        portraitUrl: null,
        stats: {
          brains: 4,
          brawn: 3,
          luck: 4,
        },
      },
    });

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
              causeId: "knife-ambush",
              causeLabel: "Knifed",
              summary: "The Babadook stabs Avery Chen at the Cornucopia.",
              killerTributeIds: [killer.id],
              resolvedEventId: "event-1",
            },
          }),
          killer,
        ]}
      />,
    );

    expect(screen.getByText("Knifed by The Babadook")).toBeInTheDocument();

    expect(
      screen.getByText("The Babadook stabs Avery Chen at the Cornucopia."),
    ).toBeInTheDocument();
  });
});
