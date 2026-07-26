import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createDefaultTributeSurvivalState,
  type TributeSurvivalState,
} from "~/game/survival/survival-schema";

import type {
  GameTribute,
  StatusEffect,
} from "~/game/types/game-state";
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

function getStatusList(name = "Avery Chen"): HTMLElement {
  return screen.getByRole("list", {
    name: `${name} active statuses`,
  });
}

function getStatusEntries(name = "Avery Chen"): HTMLElement[] {
  return within(getStatusList(name)).getAllByRole("listitem");
}

function getStatusIds(name = "Avery Chen"): (string | null)[] {
  return getStatusEntries(name).map((item) => item.getAttribute("data-status-id"));
}

function getStatusButton(statusId: StatusEffect["definitionId"]): HTMLElement {
  const entry = getStatusEntries().find((item) => item.getAttribute("data-status-id") === statusId);

  if (!entry) {
    throw new Error(`Could not find rendered status "${statusId}".`);
  }

  return within(entry).getByRole("button");
}

describe("TributeSidebar", () => {
  it("renders no status tray when the tribute has no statuses", () => {
    render(<TributeSidebar tributes={[createTribute()]} />);

    expect(
      screen.queryByRole("list", {
        name: "Avery Chen active statuses",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders one active status as an icon over the portrait", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("hungry", null)],
          }),
        ]}
      />,
    );

    const statusList = getStatusList();
    const portrait = statusList.closest(".sidebar-tribute__portrait");

    expect(portrait).not.toBeNull();
    expect(statusList).toHaveClass("sidebar-tribute__status-icons");
    expect(getStatusIds()).toEqual(["hungry"]);

    const hungryButton = getStatusButton("hungry");

    expect(hungryButton).toHaveAccessibleName(/Hungry\. Persistent need\. Severity 1 of 3\./);

    expect(hungryButton.querySelector('[data-status-icon="hungry"]')).not.toBeNull();
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

    expect(
      getStatusButton("exhausted").querySelector('[data-status-icon="exhausted"]'),
    ).toHaveTextContent("Zz");
  });

  it("uses severity marks and critical styling for severe thirst", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("thirsty", null, 3)],
          }),
        ]}
      />,
    );

    const thirstyButton = getStatusButton("thirsty");

    expect(thirstyButton).toHaveAttribute("data-status-tone", "critical");
    expect(
      thirstyButton.querySelectorAll(".sidebar-tribute__status-severity-mark--active"),
    ).toHaveLength(3);
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

    expect(getStatusButton("injured")).toHaveAttribute("data-status-kind", "harmful");

    expect(getStatusButton("lucky")).toHaveAttribute("data-status-kind", "beneficial");

    expect(getStatusButton("lucky")).toHaveAttribute("data-status-tone", "beneficial");
  });

  it("renders at least five simultaneous status icons without collapsing them", () => {
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

    expect(within(getStatusList()).queryByText(/^\+\d+$/)).not.toBeInTheDocument();
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
  });

  it("changing morning rest leaves unrelated status icons visible", () => {
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

    expect(screen.getByLabelText("Rested comfortably during Night 3.")).toBeInTheDocument();

    expect(getStatusIds()).toEqual(["exhausted", "hungry"]);
  });

  it("keeps full status information in the icon tooltip", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("poisoned", 1, 3)],
          }),
        ]}
      />,
    );

    const poisonedButton = getStatusButton("poisoned");

    expect(poisonedButton).toHaveAccessibleName(
      /Poisoned\. Fatal condition\. Severity 3 of 3\. 1 round\./,
    );

    const poisonedEntry = getStatusEntries()[0];
    const tooltip = within(poisonedEntry).getByRole("tooltip");

    expect(tooltip).toHaveTextContent("Poisoned");
    expect(tooltip).toHaveTextContent("Fatal condition · Severity 3 of 3");
    expect(tooltip).toHaveTextContent("Fatal at the end of the next round if untreated.");
    expect(tooltip).toHaveTextContent("Gameplay effects");
    expect(tooltip).toHaveTextContent("Fatal outcome: Poisoning");
  });

  it("marks a next-round fatal status without relying only on colour", () => {
    render(
      <TributeSidebar
        tributes={[
          createTribute({
            statuses: [createStatus("bleeding", 1, 2)],
          }),
        ]}
      />,
    );

    const bleedingButton = getStatusButton("bleeding");

    expect(bleedingButton).toHaveAttribute("data-imminent-fatal", "true");

    expect(bleedingButton).toHaveAccessibleName(/Fatal at the end of the next round if untreated/);
  });

  it("filters expired statuses from the icon tray", () => {
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

  it("retains every status icon at a narrow viewport width", () => {
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

    expect(getStatusEntries()).toHaveLength(5);
    expect(getStatusIds()).toEqual(["bleeding", "exhausted", "hungry", "thirsty", "well-rested"]);
  });

  it("keeps the death presentation distinct and hides live status icons", () => {
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
