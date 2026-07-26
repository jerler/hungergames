import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import type { TributeSurvivalState } from "~/game/survival/survival-schema";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

import { TributeSidebar } from "./tribute-sidebar";

function createTribute(overrides: Partial<GameTribute> = {}): GameTribute {
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
  id = `status-${definitionId}`,
): StatusEffect {
  return {
    id,
    definitionId,
    severity,
    remainingRounds,
    sourceEventId: `event-${definitionId}`,
    sourceTributeId: null,
    appliedRound: {
      day: 2,
      period: "day",
    },
  };
}

function getStatusItems(name = "Avery Chen"): HTMLElement[] {
  return within(
    screen.getByRole("list", {
      name: `${name} active statuses`,
    }),
  ).getAllByRole("listitem");
}

function getStatusIds(name = "Avery Chen"): (string | null)[] {
  return getStatusItems(name).map((item) => item.getAttribute("data-status-id"));
}

describe("TributeSidebar", () => {
  it("renders no status list when the tribute has no statuses", () => {
    render(<TributeSidebar tributes={[createTribute()]} />);

    expect(
      screen.queryByRole("list", {
        name: "Avery Chen active statuses",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders one active status with a visible label", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("hungry", null)],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["hungry"]);
    expect(screen.getByText("Hungry", { selector: "summary strong" })).toBeVisible();
    expect(screen.getByText("Persistent need · Severity 1 of 3")).toBeVisible();
  });

  it("shows hungry and thirsty together in stable order", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("thirsty", null), createStatus("hungry", null)],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["hungry", "thirsty"]);
  });

  it("shows exhausted, hungry, and thirsty simultaneously", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [
              createStatus("thirsty", null),
              createStatus("hungry", null),
              createStatus("exhausted", 2, 2),
            ],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["exhausted", "hungry", "thirsty"]);
  });

  it("keeps harmful and beneficial statuses visually and textually distinct", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("lucky", 2, 2), createStatus("injured", 2, 2)],
          }),
        ]}
      />,
    );

    const [injuredItem, luckyItem] = getStatusItems();

    expect(injuredItem).toHaveAttribute("data-status-id", "injured");
    expect(luckyItem).toHaveAttribute("data-status-id", "lucky");

    expect(within(injuredItem).getByText(/Harmful status/)).toBeVisible();
    expect(within(luckyItem).getByText(/Beneficial status/)).toBeVisible();
  });

  it("renders at least five simultaneous statuses without collapsing them", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [
              createStatus("lucky", 2),
              createStatus("thirsty", null),
              createStatus("hungry", null),
              createStatus("exhausted", 2, 2),
              createStatus("injured", 3, 3),
            ],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["injured", "exhausted", "hungry", "thirsty", "lucky"]);
  });

  it("clearing hunger leaves thirst visible", () => {
    const { rerender } = render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("hungry", null), createStatus("thirsty", null)],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["hungry", "thirsty"]);

    rerender(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("thirsty", null)],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["thirsty"]);
    expect(screen.queryByText("Hungry", { selector: "summary strong" })).not.toBeInTheDocument();
  });

  it("changing morning rest leaves unrelated statuses visible", () => {
    const initialSurvival: TributeSurvivalState = {
      ...createDefaultTributeSurvivalState(),
      lastNightRest: {
        round: {
          day: 2,
          period: "night",
        },
        quality: "unsheltered",
      },
    };

    const updatedSurvival: TributeSurvivalState = {
      ...initialSurvival,
      lastNightRest: {
        round: {
          day: 3,
          period: "night",
        },
        quality: "comfortable",
      },
    };

    const statuses = [createStatus("hungry", null), createStatus("exhausted", 2, 2)];

    const { rerender } = render(
      <TributeSidebar
        tributes={[
          createTribute({
            survival: initialSurvival,
            statuses,
          }),
        ]}
      />,
    );

    expect(screen.getByLabelText("Spent Night 2 without adequate shelter.")).toBeInTheDocument();
    expect(getStatusIds()).toEqual(["exhausted", "hungry"]);

    rerender(
      <TributeSidebar
        tributes={[
          createTribute({
            survival: updatedSurvival,
            statuses,
          }),
        ]}
      />,
    );

    expect(
      screen.queryByLabelText("Spent Night 2 without adequate shelter."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rested comfortably during Night 3.")).toBeInTheDocument();
    expect(getStatusIds()).toEqual(["exhausted", "hungry"]);
  });

  it("announces severity, lifecycle, description, and gameplay effects", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("poisoned", 1, 3)],
          }),
        ]}
      />,
    );

    expect(
      screen.getByLabelText(
        /Poisoned\. Fatal condition\. Severity 3 of 3\..*Fatal at the end of the next round.*Gameplay effects:/,
      ),
    ).toBeInTheDocument();

    const poisonedItem = getStatusItems()[0];

    expect(within(poisonedItem).getByText("Fatal condition · Severity 3 of 3")).toBeVisible();
  });

  it("filters expired statuses from the sidebar", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("exhausted", 0), createStatus("hungry", null)],
          }),
        ]}
      />,
    );

    expect(getStatusIds()).toEqual(["hungry"]);
  });

  it("retains every status at a narrow viewport width", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });

    window.dispatchEvent(new Event("resize"));

    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [
              createStatus("bleeding", 1),
              createStatus("exhausted", 2, 3),
              createStatus("hungry", null),
              createStatus("thirsty", null),
              createStatus("well-rested", 2),
            ],
          }),
        ]}
      />,
    );

    expect(getStatusItems()).toHaveLength(5);
    expect(getStatusIds()).toEqual(["bleeding", "exhausted", "hungry", "thirsty", "well-rested"]);
  });

  it("keeps the death presentation distinct and hides live status rows", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            isAlive: false,
            statuses: [createStatus("hungry", null)],
            death: {
              round: {
                day: 2,
                period: "day",
              },
              causeId: "starvation",
              causeLabel: "Starved",
              summary: "Avery starved.",
              killerTributeIds: [],
              resolvedEventId: "event-starvation",
            },
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Starved. Avery starved.",
      }),
    ).toHaveTextContent("Starved");

    expect(
      screen.queryByRole("list", {
        name: "Avery Chen active statuses",
      }),
    ).not.toBeInTheDocument();
  });
});
