import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { DEPRIVATION_EVENTS } from "~/game/events/catalogue/encounters/deprivation-events";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { EventDefinition } from "~/game/events/event-schema";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

import { completeNightRestCoverage } from "./night-rest-coverage";
import { prepareRound } from "./round-preparation";

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

const DAY_THREE = {
  day: 3,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_THREE = {
  day: 3,
  period: "night",
} as const satisfies RoundReference;

function requireDefinition(definitionId: string): EventDefinition {
  const definition = DEPRIVATION_EVENTS.find((candidate) => candidate.id === definitionId);

  if (!definition) {
    throw new Error(`Missing "${definitionId}".`);
  }

  return definition;
}

function createNightEvent(
  definition: EventDefinition,
  state: GameState,
  tribute: GameTribute,
): ResolvedEvent {
  const eventId = `night-3-0-${definition.id}`;

  const resolution = definition.resolve({
    state,
    round: NIGHT_THREE,
    livingTributes: [tribute],
    eventId,
    random: () => 0,
    participantsByRole: {
      tribute: [tribute],
    },
  });

  return {
    id: eventId,
    definitionId: definition.id,
    kind: "primary",
    resolutionMode: "standard",
    round: NIGHT_THREE,
    participantTributeIds: [tribute.id],
    text: resolution.text,
    changes: resolution.changes,
  };
}

function countRestChanges(event: ResolvedEvent, tributeId: string): number {
  return event.changes.filter(
    (change) => change.type === "record-night-rest" && change.tributeId === tributeId,
  ).length;
}

function withStatuses(
  tribute: GameTribute,
  statusIds: readonly ("hungry" | "thirsty" | "exhausted" | "well-rested")[],
): GameTribute {
  return {
    ...tribute,
    statuses: statusIds.map((statusId) =>
      createStatusEffectInstance(
        `status-${statusId}`,
        tribute.id,
        statusId,
        statusId === "well-rested" ? 2 : 1,
        NIGHT_TWO,
      ),
    ),
  };
}

describe("rest and deprivation integration", () => {
  it.each(["becomes-hungry", "becomes-thirsty"])(
    "adds exactly one valid rest outcome to nighttime %s",
    (definitionId) => {
      const tribute = createAuthoringTestTribute();
      const state = createAuthoringTestGame([tribute]);
      const rawEvent = createNightEvent(requireDefinition(definitionId), state, tribute);

      expect(countRestChanges(rawEvent, tribute.id)).toBe(0);

      const [completedEvent] = completeNightRestCoverage(state, NIGHT_THREE, [rawEvent]);

      expect(completedEvent).toBeDefined();
      expect(completedEvent ? countRestChanges(completedEvent, tribute.id) : 0).toBe(1);
      expect(completedEvent?.text).toMatch(/remains exposed through the night/i);
    },
  );

  it("rejects duplicate night-rest changes", () => {
    const tribute = createAuthoringTestTribute();
    const state = createAuthoringTestGame([tribute]);

    const duplicateRestEvent: ResolvedEvent = {
      id: "duplicate-rest",
      definitionId: "duplicate-rest",
      kind: "primary",
      resolutionMode: "standard",
      round: NIGHT_THREE,
      participantTributeIds: [tribute.id],
      text: "Duplicate rest.",
      changes: [
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: NIGHT_THREE,
          quality: "unsheltered",
        },
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: NIGHT_THREE,
          quality: "sheltered",
        },
      ],
    };

    expect(() => completeNightRestCoverage(state, NIGHT_THREE, [duplicateRestEvent])).toThrow(
      /receives 2 night-rest outcomes/i,
    );
  });

  it.each([
    ["comfortable", "well-rested"],
    ["unsheltered", "exhausted"],
  ] as const)("resolves %s rest without clearing deprivation", (quality, expectedRestStatus) => {
    const base = createAuthoringTestTribute();
    const tribute = {
      ...withStatuses(base, ["hungry", "thirsty"]),
      survival: {
        ...base.survival,
        lastNightRest: {
          round: NIGHT_TWO,
          quality,
        },
      },
    };

    const state = createAuthoringTestGame([tribute]);
    const prepared = prepareRound(state, DAY_THREE);
    const nextTribute = prepared.state.tributes[0];

    expect(
      prepared.automaticEvents.some(
        (event) => event.preparation?.mechanic === "morning-rest-resolution",
      ),
    ).toBe(true);
    expect(nextTribute?.statuses.map((status) => status.definitionId)).toEqual(
      expect.arrayContaining(["hungry", "thirsty", expectedRestStatus]),
    );
  });

  it("eating and drinking do not clear exhaustion", () => {
    const base = createAuthoringTestTribute();
    const tribute = withStatuses(base, ["hungry", "thirsty", "exhausted"]);
    const state: GameState = {
      ...createAuthoringTestGame([tribute]),
      currentRound: DAY_THREE,
    };

    const event: ResolvedEvent = {
      id: "eat-and-drink",
      definitionId: "eat-and-drink",
      kind: "primary",
      resolutionMode: "standard",
      round: DAY_THREE,
      participantTributeIds: [tribute.id],
      text: `${tribute.snapshot.name} eats and drinks.`,
      changes: [
        {
          type: "satisfy-survival-need",
          tributeId: tribute.id,
          need: "food",
        },
        {
          type: "satisfy-survival-need",
          tributeId: tribute.id,
          need: "water",
        },
      ],
    };

    const nextState = applyResolvedEvent(state, event);
    const nextTribute = nextState.tributes[0];

    expect(nextTribute?.statuses.some((status) => status.definitionId === "exhausted")).toBe(true);
    expect(
      nextTribute?.statuses.some(
        (status) => status.definitionId === "hungry" || status.definitionId === "thirsty",
      ),
    ).toBe(false);
  });
});
