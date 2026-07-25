import { fireEvent, render, screen, within } from "@testing-library/react";

import { describe, expect, it } from "vitest";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";

import type { GameTribute } from "~/game/types/game-state";

import type { TributeStats } from "~/game/types/tribute";

import { InventorySummary } from "./inventory-summary";

const TEST_ROUND = {
  day: 1,

  period: "day",
} as const;

function createTribute({
  id = "tribute-1",

  name = "Avery Chen",

  itemIds = [],

  stats = {},

  isAlive = true,
}: {
  id?: string;
  name?: string;
  itemIds?: readonly ItemDefinitionId[];
  stats?: Partial<TributeStats>;
  isAlive?: boolean;
} = {}): GameTribute {
  const inventory = itemIds.map((itemId) =>
    createInventoryItemInstance(
      `event-${itemId}`,

      id,

      itemId,

      TEST_ROUND,
    ),
  );

  return {
    id,

    sourceDefinitionId: null,

    district: 1,

    districtPosition: 1,

    snapshot: {
      name,

      pronouns: "they",

      portraitUrl: null,

      stats: {
        brains: 3,

        brawn: 3,

        luck: 3,

        ...stats,
      },
    },

    isAlive,

    death: isAlive
      ? null
      : {
          round: TEST_ROUND,

          causeId: "test-death",

          causeLabel: "Eliminated",

          summary: `${name} was eliminated.`,

          killerTributeIds: [],

          resolvedEventId: "event-death",
        },

    survival: createDefaultTributeSurvivalState(),

    statuses: [],

    inventory,

    allianceId: null,

    statistics: {
      kills: 0,

      attemptedKills: 0,

      giftsReceived: 0,

      eventsSurvived: 0,
    },
  };
}

describe("InventorySummary", () => {
  it("shows an empty state when no living tribute owns an item", () => {
    render(<InventorySummary tributes={[createTribute()]} />);

    expect(screen.getByText("No living tribute currently possesses an item.")).toBeInTheDocument();
  });

  it("shows complete owner-specific item details", () => {
    render(
      <InventorySummary
        tributes={[
          createTribute({
            itemIds: ["warhammer"],

            stats: {
              brawn: 4,
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText("Avery Chen")).toBeInTheDocument();

    expect(screen.getByText("Warhammer")).toBeInTheDocument();

    expect(screen.getByText("Unusable")).toBeInTheDocument();

    expect(screen.getByText("Brawn 5")).toBeInTheDocument();

    expect(screen.getByText("Requires Brawn 5; Avery Chen has 4.")).toBeInTheDocument();

    expect(screen.getByText("Adds +1.9 to direct attack score when usable.")).toBeInTheDocument();
  });

  it("uses a native keyboard-accessible disclosure", () => {
    const { container } = render(
      <InventorySummary
        tributes={[
          createTribute({
            itemIds: ["bottled-water"],
          }),
        ]}
      />,
    );

    const details = container.querySelector("details");

    const summary = container.querySelector("summary");

    expect(details).not.toHaveAttribute("open");

    expect(summary).not.toBeNull();

    fireEvent.click(summary!);

    expect(details).toHaveAttribute("open");

    expect(within(details!).getByText("Restores hydration.")).toBeInTheDocument();
  });

  it("excludes inventories belonging to dead tributes", () => {
    render(
      <InventorySummary
        tributes={[
          createTribute({
            id: "living",

            name: "Living Tribute",

            itemIds: ["knife"],
          }),

          createTribute({
            id: "dead",

            name: "Dead Tribute",

            itemIds: ["med-kit"],

            isAlive: false,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Living Tribute")).toBeInTheDocument();

    expect(screen.queryByText("Dead Tribute")).not.toBeInTheDocument();

    expect(screen.queryByText("Med kit")).not.toBeInTheDocument();
  });
});
