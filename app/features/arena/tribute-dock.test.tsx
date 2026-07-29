// Generated tribute dock tests.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import type { GameTribute, Truce } from "~/game/types/game-state";

import { TributeDock } from "./tribute-dock";

function createTribute({
  id,
  name,
  district,
  districtPosition,
  isAlive = true,
}: {
  id: string;
  name: string;
  district: number;
  districtPosition: 1 | 2;
  isAlive?: boolean;
}): GameTribute {
  return {
    id,
    sourceDefinitionId: null,
    district,
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
    isAlive,
    death: isAlive
      ? null
      : {
          round: {
            day: 2,
            period: "day",
          },
          causeId: "test-death",
          causeLabel: "Killed in the arena",
          summary: `${name} was killed in the arena.`,
          killerTributeIds: [],
          resolvedEventId: "test-event",
        },
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

const AVERY = createTribute({
  id: "avery",
  name: "Avery Chen",
  district: 1,
  districtPosition: 1,
});

const BLAKE = createTribute({
  id: "blake",
  name: "Blake Morgan",
  district: 1,
  districtPosition: 2,
});

const CASEY = createTribute({
  id: "casey",
  name: "Casey Singh",
  district: 2,
  districtPosition: 1,
  isAlive: false,
});

function createRoster(livingCount: number, fallenCount: number): GameTribute[] {
  return Array.from(
    {
      length: livingCount + fallenCount,
    },
    (_, index) =>
      createTribute({
        id: `tribute-${index + 1}`,
        name: `Tribute ${index + 1}`,
        district: Math.floor(index / 2) + 1,
        districtPosition: index % 2 === 0 ? 1 : 2,
        isAlive: index < livingCount,
      }),
  );
}

const ROMANTIC_TRUCE = {
  id: "romantic-truce",
  kind: "romantic",
  tributeIds: ["avery", "blake"],
  createdRound: {
    day: 2,
    period: "night",
  },
  expiresAfterRound: null,
} satisfies Truce;

describe("TributeDock", () => {
  it("does not render a fallen section before the first death", () => {
    render(<TributeDock tributes={[AVERY, BLAKE]} truces={[]} />);

    expect(
      screen.queryByRole("region", {
        name: "Fallen tributes",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders fallen tributes only after a death", () => {
    render(<TributeDock tributes={[AVERY, BLAKE, CASEY]} truces={[]} />);

    expect(
      screen.getByRole("region", {
        name: "Fallen tributes",
      }),
    ).toHaveTextContent("Casey Singh");
  });

  it("places relationships alongside the living portraits", () => {
    render(<TributeDock tributes={[AVERY, BLAKE]} truces={[ROMANTIC_TRUCE]} />);

    const relationship = screen.getByLabelText("Romantic relationship: Avery Chen, Blake Morgan");

    expect(relationship).toHaveAttribute("data-relationship-kind", "romantic");
    expect(relationship.closest(".tribute-dock__living-list")).not.toBeNull();
  });

  it("can collapse manually while retaining the portrait content", () => {
    const { container } = render(
      <TributeDock tributes={[AVERY, BLAKE]} truces={[ROMANTIC_TRUCE]} />,
    );

    const toggle = screen.getByRole("button", {
      name: /collapse/i,
    });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".tribute-dock")).toHaveAttribute("data-expanded", "false");
    expect(screen.getByLabelText(/Avery Chen, District 1, alive/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Romantic relationship: Avery Chen, Blake Morgan"),
    ).toBeInTheDocument();
  });

  it("stays collapsed across repeated scroll events", () => {
    const originalScrollY = window.scrollY;

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
      writable: true,
    });

    const { container } = render(<TributeDock tributes={[AVERY, BLAKE]} truces={[]} />);

    const dock = container.querySelector(".tribute-dock");

    expect(dock).toHaveAttribute("data-expanded", "true");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 200,
      writable: true,
    });

    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.scroll(window);

    expect(dock).toHaveAttribute("data-expanded", "false");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: originalScrollY,
      writable: true,
    });
  });
  it("uses five living columns and up to eight fallen columns for a ten-survivor roster", () => {
    const { container } = render(<TributeDock tributes={createRoster(10, 14)} truces={[]} />);

    const dock = container.querySelector(".tribute-dock");

    expect(dock).toHaveAttribute("data-living-columns", "5");
    expect(dock).toHaveAttribute("data-fallen-columns", "8");
  });

  it("uses one living column per survivor when five or fewer remain", () => {
    const { container } = render(<TributeDock tributes={createRoster(5, 19)} truces={[]} />);

    const dock = container.querySelector(".tribute-dock");

    expect(dock).toHaveAttribute("data-living-columns", "5");
    expect(dock).toHaveAttribute("data-fallen-columns", "8");
  });
});
