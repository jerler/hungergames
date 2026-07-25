import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import type {
  EliminateTributeChange,
  EventFeedGroup,
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

    expect(screen.getByText("Item: Fresh water")).toBeInTheDocument();

    expect(screen.getByText("Borrowed from: Peeta")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Food and hydration",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("No uses remaining")).toBeInTheDocument();

    expect(screen.getByText("Need restored: Hydration.")).toBeInTheDocument();

    expect(screen.getByText("Statuses resolved: Thirsty.")).toBeInTheDocument();
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

    expect(
      screen.getByRole("heading", {
        name: "Rest and shelter",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Rest result: Comfortable rest.")).toBeInTheDocument();

    expect(screen.getByText("0 of 3 arena events revealed")).toBeInTheDocument();

    expect(screen.getByText(/reveal the first event/i)).toBeInTheDocument();
  });

  it("keeps preparation groups separate while preserving primary numbering", () => {
    const medicalEvent: ResolvedEvent = {
      id: "medical-preparation",
      definitionId: "automatic-medical-treatment",

      kind: "preparation",
      resolutionMode: "standard",

      round: TEST_ROUND,

      participantTributeIds: [ACTOR.id],

      text: "Katniss treats her injuries.",

      changes: [],

      preparation: {
        mechanic: "medical-treatment",

        actingTributeId: ACTOR.id,

        affectedStatusIds: ["injured"],
      },
    };

    const hydrationEvent: ResolvedEvent = {
      id: "hydration-preparation",
      definitionId: "automatic-hydration-consumption",

      kind: "preparation",
      resolutionMode: "standard",

      round: TEST_ROUND,

      participantTributeIds: [OWNER.id],

      text: "Peeta drinks fresh water.",

      changes: [],

      preparation: {
        mechanic: "hydration-consumption",

        actingTributeId: OWNER.id,

        affectedNeed: "water",
      },
    };

    renderFeed([hydrationEvent, medicalEvent, createEvent([])], 2);

    const headings = screen.getAllByRole("heading");

    expect(headings.map((heading) => heading.textContent)).toEqual(
      expect.arrayContaining(["Before the round", "Medical care", "Food and hydration"]),
    );

    expect(screen.getByText("01")).toBeInTheDocument();

    expect(screen.getByText("1 of 2 arena events revealed")).toBeInTheDocument();
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
