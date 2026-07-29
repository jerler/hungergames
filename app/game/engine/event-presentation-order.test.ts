import { describe, expect, it } from "vitest";

import type {
  EventFeedGroup,
  GameChange,
  ResolvedEvent,
  RoundReference,
  Truce,
} from "~/game/types/game-state";

import { shuffleRoundEventsForPresentation } from "./event-presentation-order";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

const DAY_THREE = {
  day: 3,
  period: "day",
} as const satisfies RoundReference;

function createState(seed: string, truces: readonly Truce[] = []) {
  return {
    seed,
    truces,
    vendettas: [],
  };
}

function createEvent(
  id: string,
  round: RoundReference,
  options: {
    feedGroup?: EventFeedGroup;
    definitionId?: string;
    changes?: readonly GameChange[];
  } = {},
): ResolvedEvent {
  return {
    id,
    definitionId: options.definitionId ?? `definition-${id}`,
    kind: "primary",
    resolutionMode: "standard",
    feedGroup: options.feedGroup,
    round,
    participantTributeIds: [`tribute-${id}`],
    text: `Event ${id}`,
    changes: [...(options.changes ?? [])],
  };
}

function getIds(events: readonly ResolvedEvent[]): string[] {
  return events.map((event) => event.id);
}

describe("event presentation order", () => {
  it("deterministically varies ordinary independent events", () => {
    const events = ["A", "B", "C", "D", "E", "F"].map((id) => createEvent(id, DAY_THREE));
    const first = shuffleRoundEventsForPresentation(
      createState("ordinary-seed"),
      DAY_THREE,
      events,
    );
    const repeat = shuffleRoundEventsForPresentation(
      createState("ordinary-seed"),
      DAY_THREE,
      events,
    );

    expect(first).toEqual(repeat);
    expect(new Set(getIds(first))).toEqual(new Set(getIds(events)));

    const observedOrders = new Set(
      Array.from(
        {
          length: 12,
        },
        (_, index) =>
          getIds(
            shuffleRoundEventsForPresentation(
              createState(`ordinary-seed-${index}`),
              DAY_THREE,
              events,
            ),
          ).join(","),
      ),
    );

    expect(observedOrders.size).toBeGreaterThan(1);
  });

  it("keeps podiums before shuffled Cornucopia and fleeing events", () => {
    const events = [
      createEvent("f1", DAY_ONE, {
        feedGroup: "bloodbath-flee",
      }),
      createEvent("c1", DAY_ONE, {
        feedGroup: "bloodbath-cornucopia",
      }),
      createEvent("podium", DAY_ONE, {
        feedGroup: "bloodbath-cornucopia",
        definitionId: "cornucopia-fatal-podium-detonation-bits",
      }),
      createEvent("c2", DAY_ONE, {
        feedGroup: "bloodbath-cornucopia",
      }),
      createEvent("f2", DAY_ONE, {
        feedGroup: "bloodbath-flee",
      }),
    ];

    const shuffled = shuffleRoundEventsForPresentation(
      createState("bloodbath-seed"),
      DAY_ONE,
      events,
    );

    expect(shuffled[0]?.definitionId).toBe("cornucopia-fatal-podium-detonation-bits");

    const firstFleeIndex = shuffled.findIndex((event) => event.feedGroup === "bloodbath-flee");

    expect(
      shuffled
        .slice(1, firstFleeIndex)
        .every((event) => event.feedGroup === "bloodbath-cornucopia"),
    ).toBe(true);
  });

  it("preserves canonical slots for a truce break and a death that can dissolve it", () => {
    const truce: Truce = {
      id: "existing-truce",
      kind: "standard",
      tributeIds: ["tribute-one", "tribute-two"],
      createdRound: {
        day: 1,
        period: "day",
      },
      expiresAfterRound: {
        day: 3,
        period: "night",
      },
    };
    const events = [
      createEvent("movable-a", DAY_THREE),
      createEvent("explicit-break", DAY_THREE, {
        changes: [
          {
            type: "break-truce",
            truceId: truce.id,
            reason: "betrayal",
          },
        ],
      }),
      createEvent("movable-b", DAY_THREE),
      createEvent("member-death", DAY_THREE, {
        changes: [
          {
            type: "eliminate-tribute",
            tributeId: "tribute-one",
            causeId: "test-death",
            causeLabel: "Test death",
            summary: "A relationship-sensitive death.",
            killerTributeIds: [],
          },
        ],
      }),
      createEvent("movable-c", DAY_THREE),
    ];

    const shuffled = shuffleRoundEventsForPresentation(
      createState("relationship-seed", [truce]),
      DAY_THREE,
      events,
    );

    expect(shuffled[1]?.id).toBe("explicit-break");
    expect(shuffled[3]?.id).toBe("member-death");
  });

  it("preserves a newly formed truce relative to a dependent death", () => {
    const newTruce: Truce = {
      id: "new-truce",
      kind: "standard",
      tributeIds: ["future-member-one", "future-member-two"],
      createdRound: DAY_THREE,
      expiresAfterRound: {
        day: 4,
        period: "day",
      },
    };
    const events = [
      createEvent("movable-a", DAY_THREE),
      createEvent("form-truce", DAY_THREE, {
        changes: [
          {
            type: "form-truce",
            truce: newTruce,
          },
        ],
      }),
      createEvent("movable-b", DAY_THREE),
      createEvent("future-member-death", DAY_THREE, {
        changes: [
          {
            type: "eliminate-tribute",
            tributeId: "future-member-one",
            causeId: "test-death",
            causeLabel: "Test death",
            summary: "A dependent death.",
            killerTributeIds: [],
          },
        ],
      }),
    ];

    const shuffled = shuffleRoundEventsForPresentation(
      createState("new-relationship-seed"),
      DAY_THREE,
      events,
    );

    expect(shuffled[1]?.id).toBe("form-truce");
    expect(shuffled[3]?.id).toBe("future-member-death");
  });

  it("does not mutate the sequenced array", () => {
    const events = ["A", "B", "C"].map((id) => createEvent(id, DAY_THREE));
    const originalOrder = getIds(events);

    shuffleRoundEventsForPresentation(createState("mutation-test"), DAY_THREE, events);

    expect(getIds(events)).toEqual(originalOrder);
  });
});
