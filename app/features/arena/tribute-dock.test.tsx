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

  it("places a relationship connector between the existing living portraits without duplicating them", () => {
    const { container } = render(
      <TributeDock tributes={[AVERY, BLAKE]} truces={[ROMANTIC_TRUCE]} />,
    );

    const livingList = container.querySelector(".tribute-dock__living-list");

    expect(livingList).not.toBeNull();

    const livingChildren = [...(livingList?.children ?? [])];

    expect(livingChildren).toHaveLength(3);
    expect(livingChildren[0]).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Avery Chen, District 1, alive/i),
    );
    expect(livingChildren[1]).toHaveClass("tribute-dock__relationship-connector-item");
    expect(livingChildren[1]).toHaveAttribute("data-relationship-kind", "romantic");
    expect(livingChildren[1]).toHaveAttribute(
      "aria-label",
      "Romantic relationship: Avery Chen, Blake Morgan",
    );
    expect(livingChildren[2]).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Blake Morgan, District 1, alive/i),
    );

    expect(container.querySelector(".tribute-dock__relationship-portrait")).not.toBeInTheDocument();

    expect(screen.getAllByLabelText(/Avery Chen, District 1, alive/i)).toHaveLength(1);
    expect(screen.getAllByLabelText(/Blake Morgan, District 1, alive/i)).toHaveLength(1);
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
  it("marks six to ten survivors for large portraits", () => {
    const { container } = render(<TributeDock tributes={createRoster(10, 4)} truces={[]} />);

    expect(container.querySelector(".tribute-dock")).toHaveAttribute(
      "data-living-profile-size",
      "large",
    );
  });

  it("marks five or fewer survivors for the largest portraits", () => {
    const { container } = render(<TributeDock tributes={createRoster(5, 9)} truces={[]} />);

    expect(container.querySelector(".tribute-dock")).toHaveAttribute(
      "data-living-profile-size",
      "largest",
    );
  });
  it("places the header and living roster beside the full-height fallen panel", () => {
    const { container } = render(<TributeDock tributes={[AVERY, BLAKE, CASEY]} truces={[]} />);

    const content = container.querySelector<HTMLElement>(".tribute-dock__content");
    const main = container.querySelector<HTMLElement>(".tribute-dock__main");
    const header = container.querySelector<HTMLElement>(".tribute-dock__header");
    const living = container.querySelector<HTMLElement>(".tribute-dock__living");
    const fallen = container.querySelector<HTMLElement>(".tribute-dock__fallen");

    expect(content).not.toBeNull();
    expect(main).not.toBeNull();
    expect(fallen).not.toBeNull();
    expect(content?.children).toHaveLength(2);
    expect(content?.firstElementChild).toBe(main);
    expect(main).toContainElement(header);
    expect(main).toContainElement(living);
    expect(fallen?.parentElement).toBe(content);
  });
});
