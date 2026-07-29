import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { CORNUCOPIA_PROVISION_EVENTS } from "~/game/events/catalogue/encounters/cornucopia-provision-events";
import { selectEventParticipants } from "~/game/events/participant-selection";
import {
  applyMissingNightRestBookkeeping,
  completeNightRestCoverage,
} from "~/game/survival/night-rest-coverage";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";

import { DEPRIVATION_EVENTS } from "./deprivation-events";

const DAY_TWO_NIGHT = {
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

function requireEvent(eventId: string): EventDefinition {
  const definition = DEPRIVATION_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing deprivation event "${eventId}".`);
  }

  return definition;
}

function createContext(tribute: GameTribute, round: RoundReference): EventSelectionContext {
  const state: GameState = {
    ...createAuthoringTestGame([tribute]),
    currentRound: round,
  };

  return {
    state,
    round,
    livingTributes: [tribute],
  };
}

function select(definition: EventDefinition, context: EventSelectionContext) {
  return selectEventParticipants(
    definition,
    context,
    () => 0.5,
    new Set<string>(),
    new Set<string>(),
  );
}

function resolve(
  definition: EventDefinition,
  tribute: GameTribute,
  round: RoundReference,
  randomValue: number,
): ResolvedEvent {
  const context = createContext(tribute, round);
  const selection = select(definition, context);

  if (!selection) {
    throw new Error(`Could not select "${definition.id}".`);
  }

  const eventId = `${round.period}-${round.day}-0-` + definition.id;
  const resolution = definition.resolve({
    ...context,
    eventId,
    random: () => randomValue,
    participantsByRole: selection.participantsByRole,
    itemsByRole: selection.itemsByRole,
    unavailableItemInstanceIds: new Set<string>(),
  });

  return {
    id: eventId,
    definitionId: definition.id,
    kind: "primary",
    resolutionMode: "standard",
    round,
    participantTributeIds: selection.participantTributeIds,
    text: resolution.text,
    changes: resolution.changes,
  };
}

describe("deprivation events", () => {
  it.each(["becomes-hungry", "becomes-thirsty"] as const)(
    "%s is impossible before the threshold",
    (eventId) => {
      const tribute = createAuthoringTestTribute();
      const context = createContext(tribute, DAY_TWO_NIGHT);

      expect(select(requireEvent(eventId), context)).toBeNull();
    },
  );

  it.each([
    ["becomes-hungry", "hungry"],
    ["becomes-thirsty", "thirsty"],
  ] as const)("%s applies one persistent status without satisfying a need", (eventId, statusId) => {
    const tribute = createAuthoringTestTribute({
      id: `${statusId}-tribute`,
    });
    const event = resolve(requireEvent(eventId), tribute, DAY_THREE, 0);

    expect(event.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: tribute.id,
        status: expect.objectContaining({
          definitionId: statusId,
          remainingRounds: null,
        }),
      }),
    );
    expect(event.changes.some((change) => change.type === "satisfy-survival-need")).toBe(false);
    expect(
      event.changes.some(
        (change) =>
          change.type === "eliminate-tribute" ||
          change.type === "acquire-item" ||
          change.type === "consume-item",
      ),
    ).toBe(false);
  });

  it("keeps protected tributes in the provision family only", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "protected-tribute",
      }),
      "cornucopia-provisions",
    );
    const context = createContext(tribute, DAY_THREE);

    expect(select(requireEvent("becomes-hungry"), context)).toBeNull();

    const provisionEvent = CORNUCOPIA_PROVISION_EVENTS.find(
      (candidate) => candidate.id === "uses-cornucopia-provisions-food",
    );

    if (!provisionEvent) {
      throw new Error("Missing provision food event.");
    }

    expect(select(provisionEvent, context)).not.toBeNull();
  });

  it("does not repeat an existing deprivation status", () => {
    const tribute = createAuthoringTestTribute({
      id: "already-hungry",
    });
    const hungryTribute = {
      ...tribute,
      statuses: [createStatusEffectInstance("existing-hunger", tribute.id, "hungry", 1, DAY_THREE)],
    };
    const context = createContext(hungryTribute, DAY_THREE);

    expect(select(requireEvent("becomes-hungry"), context)).toBeNull();
  });

  it("uses varied text and no resource tag", () => {
    const tribute = createAuthoringTestTribute({
      id: "varied-hunger",
    });
    const definition = requireEvent("becomes-hungry");
    const first = resolve(definition, tribute, DAY_THREE, 0);
    const last = resolve(definition, tribute, DAY_THREE, 0.999);

    expect(first.text).not.toBe(last.text);
    expect(definition.tags).toContain("deprivation");
    expect(definition.tags).not.toContain("resource");
  });

  it("keeps deprivation prose authored while recording hidden night-rest bookkeeping", () => {
    const tribute = createAuthoringTestTribute({
      id: "night-hunger",
    });

    const state: GameState = {
      ...createAuthoringTestGame([tribute]),
      currentRound: NIGHT_THREE,
    };

    const event = resolve(requireEvent("becomes-hungry"), tribute, NIGHT_THREE, 0);

    const [completed] = completeNightRestCoverage(state, NIGHT_THREE, [event]);

    expect(completed).toBeDefined();
    expect(completed?.text).toBe(event.text);

    expect(completed?.changes.filter((change) => change.type === "record-night-rest")).toHaveLength(
      0,
    );

    if (!completed) {
      throw new Error("Expected the authored deprivation event to remain visible.");
    }

    const stateAfterVisibleEvent = applyResolvedEvent(
      {
        ...state,
        roundEvents: [completed],
        revealedEventCount: 1,
      },
      completed,
    );

    const stateAfterBookkeeping = applyMissingNightRestBookkeeping(stateAfterVisibleEvent);

    const bookkeepingEvent = stateAfterBookkeeping.eventHistory.find(
      (candidate) =>
        candidate.kind === "preparation" &&
        candidate.preparation?.mechanic === "night-rest-preparation" &&
        candidate.participantTributeIds.includes(tribute.id),
    );

    expect(bookkeepingEvent).toBeDefined();

    expect(bookkeepingEvent?.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: tribute.id,
      round: NIGHT_THREE,
      quality: "unsheltered",
    });
  });
});
