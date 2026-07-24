import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import type {
  EliminateTributeChange,
  GameTribute,
  ResolvedEvent,
  ResolvedEventKind,
} from "~/game/types/game-state";

import { RoundEventFeed } from "./round-event-feed";

const TEST_ROUND = {
  day: 1,
  period: "day",
} as const;

function createNamedTribute(id: string, name: string): GameTribute {
  const tribute = createAuthoringTestTribute({
    id,
  });

  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,
      name,
    },
  };
}

const ACTOR = createNamedTribute("actor", "Katniss");

const OWNER = createNamedTribute("owner", "Peeta");

function createEvent(
  eliminatedTributeIds: readonly string[],
  kind: ResolvedEventKind = "primary",
): ResolvedEvent {
  const changes = eliminatedTributeIds.map((tributeId): EliminateTributeChange => ({
    type: "eliminate-tribute",

    tributeId,

    causeId: "test-elimination",

    causeLabel: "Test elimination",

    summary: `${tributeId} was eliminated.`,

    killerTributeIds: [],
  }));

  return {
    id: `test-event-${kind}`,

    definitionId: "test-event",
    kind,
    resolutionMode: "standard",

    round: TEST_ROUND,

    participantTributeIds: [...eliminatedTributeIds],

    text: "Several cannons echo across the arena.",

    changes,
  };
}

function renderFeed(events: readonly ResolvedEvent[], totalPrimaryEventCount = 1) {
  return render(
    <RoundEventFeed
      events={events}
      round={TEST_ROUND}
      totalPrimaryEventCount={totalPrimaryEventCount}
      tributes={[ACTOR, OWNER]}
    />,
  );
}

describe("RoundEventFeed", () => {
  it.each([1, 2, 3])("renders one cannon pill for each of %s eliminations", (eliminationCount) => {
    const event = createEvent(
      Array.from(
        {
          length: eliminationCount,
        },

        (_, index) => `tribute-${index + 1}`,
      ),
    );

    renderFeed([event]);

    expect(screen.getAllByText("Cannon fired")).toHaveLength(eliminationCount);

    expect(
      screen.getByRole("group", {
        name: eliminationCount === 1 ? "1 cannon fired" : `${eliminationCount} cannons fired`,
      }),
    ).toBeInTheDocument();
  });

  it("does not render cannon pills for a nonfatal event", () => {
    renderFeed([createEvent([])]);

    expect(screen.queryByText("Cannon fired")).not.toBeInTheDocument();
  });

  it.each(["primary", "aftermath", "status-resolution"] as const)(
    "renders %s events without filtering them",
    (kind) => {
      const event = createEvent([], kind);

      const { container } = renderFeed([event]);

      expect(screen.getByText("Several cannons echo across the arena.")).toBeInTheDocument();

      expect(container.querySelector(`[data-event-kind="${kind}"]`)).toBeInTheDocument();
    },
  );

  it("groups preparation separately from primary events", () => {
    const preparationEvent: ResolvedEvent = {
      id: "preparation-water",

      definitionId: "automatic-hydration-consumption",

      kind: "preparation",
      resolutionMode: "standard",

      round: TEST_ROUND,

      participantTributeIds: [ACTOR.id, OWNER.id],

      text: "Katniss drinks Peeta's water bottle.",

      changes: [],

      preparation: {
        mechanic: "hydration-consumption",

        actingTributeId: ACTOR.id,

        itemInstanceId: "water-instance",

        itemDefinitionId: "water",

        itemOwnerTributeId: OWNER.id,

        usesRemainingAfter: 0,

        affectedNeed: "water",

        affectedStatusIds: ["thirsty"],
      },
    };

    renderFeed([preparationEvent, createEvent([])], 2);

    expect(
      screen.getByRole("heading", {
        name: "Before the round",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Katniss", {
        selector: "strong",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Item: Water bottle")).toBeInTheDocument();

    expect(screen.getByText("Borrowed from: Peeta")).toBeInTheDocument();

    expect(screen.getByText("0 uses remaining")).toBeInTheDocument();

    expect(screen.getByText("Need: Hydration")).toBeInTheDocument();

    expect(screen.getByText("Statuses: Thirsty")).toBeInTheDocument();

    expect(screen.getByText("1 of 2 arena events revealed")).toBeInTheDocument();
  });

  it("shows preparation before any primary event is revealed", () => {
    const preparationEvent: ResolvedEvent = {
      id: "night-preparation",

      definitionId: "automatic-night-rest-preparation",

      kind: "preparation",
      resolutionMode: "standard",

      round: TEST_ROUND,

      participantTributeIds: [ACTOR.id],

      text: "Katniss settles in for the night.",

      changes: [],

      preparation: {
        mechanic: "night-rest-preparation",

        actingTributeId: ACTOR.id,

        restQuality: "comfortable",
      },
    };

    renderFeed([preparationEvent], 3);

    expect(screen.getByText("Rest: Comfortable")).toBeInTheDocument();

    expect(screen.getByText("0 of 3 arena events revealed")).toBeInTheDocument();

    expect(screen.getByText(/reveal the first event/i)).toBeInTheDocument();
  });
});
