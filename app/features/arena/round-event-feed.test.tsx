import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  EliminateTributeChange,
  EventFeedGroup,
  ResolvedEvent,
  ResolvedEventKind,
} from "~/game/types/game-state";

import { RoundEventFeed } from "./round-event-feed";

const TEST_ROUND = {
  day: 1,
  period: "day",
} as const;

interface CreateEventOptions {
  id?: string;
  text?: string;
  feedGroup?: EventFeedGroup;
}

function createEvent(
  eliminatedTributeIds: readonly string[],
  kind: ResolvedEventKind = "primary",
  options: CreateEventOptions = {},
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
    id: options.id ?? `test-event-${kind}`,

    definitionId: "test-event",
    kind,
    resolutionMode: "standard",

    ...(options.feedGroup ? { feedGroup: options.feedGroup } : {}),

    round: TEST_ROUND,

    participantTributeIds: [...eliminatedTributeIds],

    text: options.text ?? "Several cannons echo across the arena.",

    changes,
  };
}

function createPreparationEvent(): ResolvedEvent {
  return {
    id: "preparation-water",
    definitionId: "automatic-hydration-consumption",
    kind: "preparation",
    resolutionMode: "standard",
    round: TEST_ROUND,
    participantTributeIds: ["tribute-1"],
    text: "Katniss drinks fresh water.",
    changes: [],
    preparation: {
      mechanic: "hydration-consumption",
      actingTributeId: "tribute-1",
      affectedNeed: "water",
    },
  };
}

function renderFeed(events: readonly ResolvedEvent[], totalPrimaryEventCount = 1) {
  return render(
    <RoundEventFeed
      events={events}
      round={TEST_ROUND}
      totalPrimaryEventCount={totalPrimaryEventCount}
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

  it("does not render automatic preparation events", () => {
    renderFeed([createPreparationEvent(), createEvent([])], 2);

    expect(screen.queryByText("Katniss drinks fresh water.")).not.toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Before the round",
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByText("Several cannons echo across the arena.")).toBeInTheDocument();

    expect(screen.getByText("1 of 2 arena events revealed")).toBeInTheDocument();
  });

  it("shows the empty state when only an automatic event is supplied", () => {
    renderFeed([createPreparationEvent()], 3);

    expect(screen.getByText("0 of 3 arena events revealed")).toBeInTheDocument();

    expect(screen.getByText(/reveal the first event/i)).toBeInTheDocument();
  });

  it("preserves arena-event numbering when an automatic event is supplied", () => {
    renderFeed([createPreparationEvent(), createEvent([])], 2);

    expect(screen.getByText("01")).toBeInTheDocument();

    expect(screen.queryByText("02")).not.toBeInTheDocument();
  });

  it("groups Bloodbath events while preserving global event numbering", () => {
    const cornucopiaEventOne = createEvent([], "primary", {
      id: "cornucopia-one",
      text: "Katniss runs for the Cornucopia.",
      feedGroup: "bloodbath-cornucopia",
    });

    const cornucopiaEventTwo = createEvent([], "primary", {
      id: "cornucopia-two",
      text: "Peeta grabs a supply pack.",
      feedGroup: "bloodbath-cornucopia",
    });

    const fleeEvent = createEvent([], "primary", {
      id: "flee-one",
      text: "Mothman disappears into the trees.",
      feedGroup: "bloodbath-flee",
    });

    renderFeed([cornucopiaEventOne, cornucopiaEventTwo, fleeEvent], 3);

    expect(
      screen
        .getAllByRole("heading", {
          level: 3,
        })
        .map((heading) => heading.textContent),
    ).toEqual(["Ran for the Cornucopia", "Ran for the trees"]);

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("does not render an empty Bloodbath group", () => {
    const cornucopiaEvent = createEvent([], "primary", {
      id: "cornucopia-only",
      feedGroup: "bloodbath-cornucopia",
    });

    renderFeed([cornucopiaEvent]);

    expect(
      screen.getByRole("heading", {
        name: "Ran for the Cornucopia",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Ran for the trees",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not hide an ungrouped event during a grouped Bloodbath feed", () => {
    const cornucopiaEvent = createEvent([], "primary", {
      id: "cornucopia-event",
      feedGroup: "bloodbath-cornucopia",
    });

    const aftermathEvent = createEvent([], "aftermath", {
      id: "aftermath-event",
      text: "The cannons echo across the arena.",
    });

    renderFeed([cornucopiaEvent, aftermathEvent], 1);

    expect(
      screen.getByRole("heading", {
        name: "Arena aftermath",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("The cannons echo across the arena.")).toBeInTheDocument();
  });

  it("keeps ordinary rounds in the flat event-feed layout", () => {
    const { container } = renderFeed([createEvent([])]);

    expect(container.querySelector("[data-event-feed-group]")).not.toBeInTheDocument();
  });
});
