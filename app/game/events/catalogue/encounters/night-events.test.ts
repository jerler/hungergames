import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameTribute, RoundReference } from "~/game/types/game-state";

import { NIGHT_EVENTS } from "./night-events";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function requireNightEvent(id: string) {
  const definition = NIGHT_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing night event "${id}".`);
  }

  return definition;
}

function createContext(
  definitionId: string,
  tributes: readonly GameTribute[],
  options: {
    randomValues?: readonly number[];
    truce?: ReturnType<typeof createTruceInstance>;
  } = {},
) {
  let randomIndex = 0;
  const state = {
    ...createAuthoringTestGame(tributes),
    currentRound: NIGHT_ROUND,
    truces: options.truce ? [options.truce] : [],
  };

  return {
    state,
    round: NIGHT_ROUND,
    livingTributes: tributes,
    eventId: `test:${definitionId}`,
    random: () => options.randomValues?.[randomIndex++] ?? 0.5,
    participantsByRole: {},
    itemsByRole: {},
  };
}

describe("revised night events", () => {
  it("registers all 34 night-only definitions with unique IDs", () => {
    expect(NIGHT_EVENTS).toHaveLength(34);
    expect(new Set(NIGHT_EVENTS.map((event) => event.id)).size).toBe(34);

    for (const event of NIGHT_EVENTS) {
      expect(event.periods).toEqual(["night"]);
      expect(event.tags).not.toContain("resource");
      expect(() => validateEventDefinition(event)).not.toThrow();
    }
  });

  it("records exactly one adequate rest result for simple sleep", () => {
    const actor = createAuthoringTestTribute({ id: "actor", name: "Actor" });
    const definition = requireNightEvent("night-simply-sleeping");
    const context = createContext(definition.id, [actor]);
    const resolution = definition.resolve({
      ...context,
      participantsByRole: { actor: [actor] },
    });

    expect(resolution.changes.filter((change) => change.type === "record-night-rest")).toEqual([
      {
        type: "record-night-rest",
        tributeId: actor.id,
        round: NIGHT_ROUND,
        quality: "sheltered",
      },
    ]);
  });

  it("records rest and removes the injured status during natural treatment", () => {
    const actor: GameTribute = {
      ...createAuthoringTestTribute({ id: "actor", name: "Actor" }),
      statuses: [
        {
          id: "injury-1",
          definitionId: "injured",
          severity: 2,
          remainingRounds: 3,
          sourceEventId: "earlier-event",
          sourceTributeId: null,
          appliedRound: { day: 2, period: "day" },
        },
      ],
    };
    const definition = requireNightEvent("night-natural-wound-treatment");
    const context = createContext(definition.id, [actor]);
    const resolution = definition.resolve({
      ...context,
      participantsByRole: { actor: [actor] },
    });

    expect(resolution.changes).toContainEqual({
      type: "remove-status",
      tributeId: actor.id,
      statusId: "injury-1",
    });
    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_ROUND,
      quality: "sheltered",
    });
  });

  it("records one rest result for every allied shift participant", () => {
    const tributes = ["one", "two", "three", "four"].map((id) =>
      createAuthoringTestTribute({ id, name: id }),
    );
    const truce = createTruceInstance(
      "test-truce",
      tributes.map((tribute) => tribute.id),
      { day: 2, period: "day" },
      { day: 3, period: "day" },
    );
    const definition = requireNightEvent("night-sleeping-shifts-four");
    const context = createContext(definition.id, tributes, { truce });
    const resolution = definition.resolve({
      ...context,
      participantsByRole: { tributes },
    });
    const rests = resolution.changes.filter((change) => change.type === "record-night-rest");

    expect(rests).toHaveLength(4);
    expect(new Set(rests.map((change) => change.tributeId))).toEqual(
      new Set(tributes.map((tribute) => tribute.id)),
    );
  });

  it("converts a two-person standard truce into a romantic truce", () => {
    const actor = createAuthoringTestTribute({ id: "actor", name: "Actor" });
    const target = createAuthoringTestTribute({ id: "target", name: "Target" });
    const truce = createTruceInstance(
      "old-truce",
      [actor.id, target.id],
      { day: 2, period: "day" },
      { day: 3, period: "day" },
    );
    const definition = requireNightEvent("night-snuggling");
    const context = createContext(definition.id, [actor, target], { truce });
    const resolution = definition.resolve({
      ...context,
      participantsByRole: { tributes: [actor, target] },
    });

    expect(resolution.changes).toContainEqual({
      type: "break-truce",
      truceId: truce.id,
      reason: "amicable",
    });
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "form-truce",
        truce: expect.objectContaining({
          kind: "romantic",
          tributeIds: [actor.id, target.id],
          expiresAfterRound: null,
        }),
      }),
    );
  });
});
