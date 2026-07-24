import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

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

function createStatus(
  definitionId: StatusEffect["definitionId"],
  remainingRounds: number | null,
  severity: StatusEffect["severity"] = 1,
): StatusEffect {
  return {
    id: `status-${definitionId}`,
    definitionId,
    severity,
    remainingRounds,
    sourceEventId: `event-${definitionId}`,

    appliedRound: {
      day: 2,
      period: "day",
    },
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
      screen.getByText(
        "An untreated wound steadily weakens the tribute and will eventually become fatal.",
      ),
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

  it("shows recovery timing for recovering statuses", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("injured", 2, 2)],
          }),
        ]}
      />,
    );

    const statusButton = screen.getByRole("button", {
      name: "Injured. Recovers in 2 rounds.",
    });

    expect(statusButton).toHaveTextContent("Injured");
    expect(statusButton).toHaveTextContent("2 rounds");

    expect(screen.getByText("Recovers in 2 rounds.")).toBeInTheDocument();
  });

  it("shows the duration of beneficial statuses", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("lucky", 2, 1)],
          }),
        ]}
      />,
    );

    const statusButton = screen.getByRole("button", {
      name: "Lucky. Wears off in 2 rounds.",
    });

    expect(statusButton).toHaveTextContent("Lucky");
    expect(statusButton).toHaveTextContent("2 rounds");

    expect(screen.getByText("Wears off in 2 rounds.")).toBeInTheDocument();
  });

  it("explains how persistent statuses are removed", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("hungry", null, 1)],
          }),
        ]}
      />,
    );

    const removalDescription = "Remains until the tribute eats enough food to recover.";

    const statusButton = screen.getByRole("button", {
      name: `Hungry. ${removalDescription}`,
    });

    expect(statusButton).toHaveTextContent("Hungry");
    expect(statusButton).toHaveTextContent("Persistent");

    expect(screen.getByText(removalDescription)).toBeInTheDocument();
  });

  it("prioritizes urgent fatal statuses while listing every active status", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [
              createStatus("lucky", 1, 2),

              createStatus("injured", 1, 3),

              createStatus("poisoned", 2, 2),

              createStatus("bleeding", 1, 1),
            ],
          }),
        ]}
      />,
    );

    const statusButton = screen.getByRole("button", {
      name: "Bleeding. Fatal at the end " + "of the next round if untreated.",
    });

    expect(statusButton).toHaveTextContent("Bleeding");
    expect(statusButton).toHaveTextContent("1 round");
    expect(statusButton).toHaveTextContent("+3");

    const tooltip = screen.getByRole("tooltip");

    const statusItems = within(tooltip).getAllByRole("listitem");

    expect(statusItems).toHaveLength(4);

    expect(statusItems[0]).toHaveTextContent(/^Bleeding/);

    expect(statusItems[1]).toHaveTextContent(/^Poisoned/);

    expect(statusItems[2]).toHaveTextContent(/^Injured/);

    expect(statusItems[3]).toHaveTextContent(/^Lucky/);
  });
});
