import { describe, expect, it } from "vitest";

import type { GameChange, ResolvedEvent } from "~/game/types/game-state";

import { createEventCardPresentation } from "./event-card-presentation";

function createEvent(
  changes: readonly GameChange[],
  overrides: Partial<ResolvedEvent> = {},
): ResolvedEvent {
  return {
    id: "presentation-test-event",
    definitionId: "presentation-test-definition",
    kind: "primary",
    resolutionMode: "standard",
    round: {
      day: 2,
      period: "day",
    },
    participantTributeIds: [],
    text: "Something happens.",
    changes: [...changes],
    ...overrides,
  };
}

function eliminate(killerTributeIds: readonly string[]): Extract<
  GameChange,
  {
    type: "eliminate-tribute";
  }
> {
  return {
    type: "eliminate-tribute",
    tributeId: "target",
    causeId: "test-death",
    causeLabel: "Test death",
    summary: "The target dies.",
    killerTributeIds: [...killerTributeIds],
  };
}

describe("event-card outcome categorization", () => {
  it("uses Arena hazard as the default", () => {
    const presentation = createEventCardPresentation(createEvent([]), []);

    expect(presentation.visualKind).toBe("hazard");

    expect(presentation.visualLabel).toBe("Arena hazard");
  });

  it("keeps item transfers and theft under the Arena hazard default", () => {
    const presentation = createEventCardPresentation(
      createEvent([
        {
          type: "transfer-item",
          itemInstanceId: "test:item:knife",
          fromTributeId: "target",
          toTributeId: "actor",
          reason: "theft",
        },
      ]),
      [],
    );

    expect(presentation.visualKind).toBe("hazard");
  });

  it("uses Status when a status is applied", () => {
    const presentation = createEventCardPresentation(
      createEvent([
        {
          type: "apply-status",
          tributeId: "target",
          status: {
            id: "test:target:injured",
            definitionId: "injured",
            severity: 1,
            remainingRounds: 2,
            sourceEventId: "presentation-test-event",
            sourceTributeId: null,
            appliedRound: {
              day: 2,
              period: "day",
            },
          },
        },
      ]),
      [],
    );

    expect(presentation.visualKind).toBe("status");
  });

  it("uses Status when a status is removed", () => {
    const presentation = createEventCardPresentation(
      createEvent([
        {
          type: "remove-status",
          tributeId: "target",
          statusId: "test:target:injured",
        },
      ]),
      [],
    );

    expect(presentation.visualKind).toBe("status");
  });

  it("uses Combat when a death has a credited killer", () => {
    const presentation = createEventCardPresentation(createEvent([eliminate(["actor"])]), []);

    expect(presentation.visualKind).toBe("combat");
  });

  it("uses Accidental death when nobody is credited", () => {
    const presentation = createEventCardPresentation(createEvent([eliminate([])]), []);

    expect(presentation.visualKind).toBe("accidental-death");

    expect(presentation.visualLabel).toBe("Accidental death");
  });

  it("gives death priority over status changes", () => {
    const presentation = createEventCardPresentation(
      createEvent([
        {
          type: "remove-status",
          tributeId: "target",
          statusId: "test:target:poisoned",
        },
        eliminate([]),
      ]),
      [],
    );

    expect(presentation.visualKind).toBe("accidental-death");
  });
});
