import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type {
  EventFeedGroup,
  GameChange,
  GameTribute,
  ResolvedEvent,
  ResolvedEventKind,
} from "~/game/types/game-state";
import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

import { RoundEventFeed } from "./round-event-feed";

const TEST_ROUND = {
  day: 1,
  period: "day",
} as const;

const KATNISS = {
  ...createAuthoringTestTribute({
    id: "katniss",
    name: "Katniss Everdeen",
  }),
  district: 12,
} satisfies GameTribute;

const PEETA = {
  ...createAuthoringTestTribute({
    id: "peeta",
    name: "Peeta Mellark",
  }),
  district: 12,
  districtPosition: 2,
} satisfies GameTribute;

const MOTHMAN = {
  ...createAuthoringTestTribute({
    id: "mothman",
    name: "Mothman",
  }),
  district: 1,
} satisfies GameTribute;

const TEST_TRIBUTES = [KATNISS, PEETA, MOTHMAN] as const;

interface CreateEventOptions {
  id?: string;
  definitionId?: string;
  text?: string;
  kind?: ResolvedEventKind;
  feedGroup?: EventFeedGroup;
  participantTributeIds?: readonly string[];
  changes?: readonly GameChange[];
}

function createEvent({
  id = "test-event",
  definitionId = "test-event",
  text = "Something dramatic happens in the arena.",
  kind = "primary",
  feedGroup,
  participantTributeIds = ["katniss"],
  changes = [],
}: CreateEventOptions = {}): ResolvedEvent {
  return {
    id,
    definitionId,
    kind,
    resolutionMode: "standard",
    ...(feedGroup ? { feedGroup } : {}),
    round: TEST_ROUND,
    participantTributeIds: [...participantTributeIds],
    text,
    changes: [...changes],
  };
}

function createPreparationEvent(): ResolvedEvent {
  return {
    id: "preparation-water",
    definitionId: "automatic-hydration-consumption",
    kind: "preparation",
    resolutionMode: "standard",
    round: TEST_ROUND,
    participantTributeIds: ["katniss"],
    text: "Katniss wakes after sheltered rest.",
    changes: [],
    preparation: {
      mechanic: "morning-rest-resolution",
      actingTributeId: "katniss",
      restQuality: "sheltered",
    },
  };
}

function renderFeed(
  events: readonly ResolvedEvent[],
  totalPrimaryEventCount = 1,
  tributes: readonly GameTribute[] = TEST_TRIBUTES,
) {
  return render(
    <RoundEventFeed
      events={events}
      tributes={tributes}
      round={TEST_ROUND}
      totalPrimaryEventCount={totalPrimaryEventCount}
    />,
  );
}

describe("RoundEventFeed", () => {
  it("replaces event numbering with the primary tribute profile", () => {
    const { container } = renderFeed([
      createEvent({
        text: "Katniss disappears into the trees.",
      }),
    ]);

    expect(screen.getByText("Katniss Everdeen")).toBeInTheDocument();
    expect(screen.getByText("District 12")).toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    expect(container.querySelector('[data-avatar-size="primary"]')).toBeInTheDocument();
  });

  it("uses the credited killer as the primary tribute even when a victim was selected first", () => {
    const knife = createInventoryItemInstance("three-way-conflict", "katniss", "knife", TEST_ROUND);

    const { container } = renderFeed([
      createEvent({
        id: "three-way-conflict",
        definitionId: "cornucopia-contested-weapon-group",
        text:
          "Katniss survives a brutal three-way fight, " +
          "killing Peeta and Mothman before escaping.",
        participantTributeIds: ["peeta", "mothman", "katniss"],
        changes: [
          {
            type: "eliminate-tribute",
            tributeId: "peeta",
            causeId: "cornucopia-contested-weapon-group",
            causeLabel: "Killed at the Cornucopia",
            summary: "Peeta is killed by Katniss.",
            killerTributeIds: ["katniss"],
          },
          {
            type: "eliminate-tribute",
            tributeId: "mothman",
            causeId: "cornucopia-contested-weapon-group",
            causeLabel: "Killed at the Cornucopia",
            summary: "Mothman is killed by Katniss.",
            killerTributeIds: ["katniss"],
          },
          {
            type: "acquire-item",
            tributeId: "katniss",
            acquisitionSource: "cornucopia",
            item: knife,
          },
        ],
      }),
    ]);

    expect(container.querySelector(".event-card__primary-identity strong")).toHaveTextContent(
      "Katniss Everdeen",
    );
  });

  it("renders every eliminated tribute in a muted death tile", () => {
    const changes: GameChange[] = [
      {
        type: "eliminate-tribute",
        tributeId: "peeta",
        causeId: "test-elimination",
        causeLabel: "Fell from a cliff",
        summary: "Peeta falls into the ravine.",
        killerTributeIds: ["katniss"],
      },
      {
        type: "eliminate-tribute",
        tributeId: "mothman",
        causeId: "test-elimination",
        causeLabel: "Crushed",
        summary: "Mothman is crushed by falling rocks.",
        killerTributeIds: [],
      },
    ];

    const { container } = renderFeed([
      createEvent({
        participantTributeIds: ["katniss", "peeta", "mothman"],
        changes,
      }),
    ]);

    expect(
      screen.getByRole("heading", {
        name: "2 eliminated",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fell from a cliff")).toBeInTheDocument();
    expect(screen.getByText("Crushed")).toBeInTheDocument();
    expect(screen.getByText("Killed by Katniss Everdeen")).toBeInTheDocument();
    expect(
      container.querySelectorAll('.event-card__death [data-event-avatar-muted="true"]'),
    ).toHaveLength(2);
  });

  it("hides status changes for tributes eliminated by the same event", () => {
    const survivorStatus = createStatusEffectInstance(
      "poison-resolution",
      "katniss",
      "injured",
      1,
      TEST_ROUND,
    );

    renderFeed([
      createEvent({
        id: "poison-resolution",
        definitionId: "poisoned-fatal-resolution",
        kind: "status-resolution",
        text: "Peeta succumbs to the poison.",
        participantTributeIds: ["peeta", "katniss"],
        changes: [
          {
            type: "remove-status",
            tributeId: "peeta",
            statusId: "earlier-event:peeta:poisoned",
          },
          {
            type: "remove-status",
            tributeId: "peeta",
            statusId: "earlier-event:peeta:exhausted",
          },
          {
            type: "apply-status",
            tributeId: "katniss",
            status: survivorStatus,
          },
          {
            type: "eliminate-tribute",
            tributeId: "peeta",
            causeId: "poisoned",
            causeLabel: "Succumbed to poison",
            summary: "Peeta succumbs to the poison.",
            killerTributeIds: [],
          },
        ],
      }),
    ]);

    expect(screen.queryByText("Poisoned cleared")).not.toBeInTheDocument();
    expect(screen.queryByText("Exhausted cleared")).not.toBeInTheDocument();

    expect(screen.getByText("Injured")).toBeInTheDocument();
    expect(screen.getByText("Succumbed to poison")).toBeInTheDocument();
  });

  it("renders status changes with their existing presentation tone", () => {
    const status = createStatusEffectInstance("status-event", "katniss", "injured", 2, TEST_ROUND);

    const { container } = renderFeed([
      createEvent({
        id: "status-event",
        changes: [
          {
            type: "apply-status",
            tributeId: "katniss",
            status,
          },
        ],
      }),
    ]);

    expect(screen.getByText("Status changes")).toBeInTheDocument();
    expect(screen.getByText("Injured")).toBeInTheDocument();
    expect(screen.getByText(/Severity 2 of 3/)).toBeInTheDocument();
    expect(container.querySelector('[data-status-tone="temporary"]')).toBeInTheDocument();
  });

  it("renders item acquisitions with the recipient and source", () => {
    const kindling = createInventoryItemInstance(
      "forage-kindling",
      "mothman",
      "kindling",
      TEST_ROUND,
    );

    renderFeed([
      createEvent({
        id: "forage-kindling",
        participantTributeIds: ["mothman"],
        changes: [
          {
            type: "acquire-item",
            tributeId: "mothman",
            acquisitionSource: "natural-foraging",
            item: kindling,
          },
        ],
      }),
    ]);

    expect(screen.getByText("Dry kindling")).toBeInTheDocument();
    expect(screen.getByText("Foraged")).toBeInTheDocument();
    expect(screen.getAllByText("Mothman").length).toBeGreaterThan(0);
  });

  it("shows both tributes and theft direction for stolen items", () => {
    const knife = createInventoryItemInstance("earlier-acquisition", "peeta", "knife", TEST_ROUND);

    const { container } = renderFeed([
      createEvent({
        id: "theft-event",
        definitionId: "steal-from-stronger-tribute",
        participantTributeIds: ["katniss", "peeta"],
        changes: [
          {
            type: "transfer-item",
            itemInstanceId: knife.id,
            fromTributeId: "peeta",
            toTributeId: "katniss",
            reason: "theft",
          },
        ],
      }),
    ]);

    expect(screen.getByText("Stolen")).toBeInTheDocument();
    expect(screen.getByText("Knife")).toBeInTheDocument();
    expect(screen.getAllByText("Katniss Everdeen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Peeta Mellark").length).toBeGreaterThan(0);
    expect(container.querySelector('[data-event-type="theft"]')).toBeInTheDocument();
    expect(container.querySelector('[data-transfer-kind="stolen"]')).toBeInTheDocument();
  });

  it("does not render automatic preparation events", () => {
    renderFeed([createPreparationEvent(), createEvent()], 2);

    expect(screen.queryByText("Katniss wakes after sheltered rest.")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 arena events revealed")).toBeInTheDocument();
  });

  it("shows the empty state when only an automatic event is supplied", () => {
    renderFeed([createPreparationEvent()], 3);

    expect(screen.getByText("0 of 3 arena events revealed")).toBeInTheDocument();
    expect(screen.getByText(/reveal the first event/i)).toBeInTheDocument();
  });

  it("keeps Bloodbath groups while removing global event numbers", () => {
    const cornucopiaEvent = createEvent({
      id: "cornucopia-one",
      text: "Katniss runs for the Cornucopia.",
      feedGroup: "bloodbath-cornucopia",
    });
    const fleeEvent = createEvent({
      id: "flee-one",
      text: "Mothman disappears into the trees.",
      feedGroup: "bloodbath-flee",
      participantTributeIds: ["mothman"],
    });

    renderFeed([cornucopiaEvent, fleeEvent], 2);

    expect(
      screen.getByRole("heading", {
        name: "Ran for the Cornucopia",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Ran for the trees",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    expect(screen.queryByText("02")).not.toBeInTheDocument();
  });

  it("does not hide an ungrouped event during a grouped Bloodbath feed", () => {
    const cornucopiaEvent = createEvent({
      id: "cornucopia-event",
      feedGroup: "bloodbath-cornucopia",
    });
    const aftermathEvent = createEvent({
      id: "aftermath-event",
      kind: "aftermath",
      text: "The cannons echo across the arena.",
    });

    renderFeed([cornucopiaEvent, aftermathEvent]);

    expect(
      screen.getByRole("heading", {
        name: "Arena aftermath",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("The cannons echo across the arena.")).toBeInTheDocument();
  });
});
