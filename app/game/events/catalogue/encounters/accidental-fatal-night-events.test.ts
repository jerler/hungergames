import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type {
  EventDefinition,
  EventItemsByRole,
  EventResolutionContext,
} from "~/game/events/event-schema";
import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type {
  GameState,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";

import { ACCIDENTAL_FATAL_NIGHT_EVENTS } from "./accidental-fatal-night-events";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function requireEvent(id: string): EventDefinition {
  const definition = ACCIDENTAL_FATAL_NIGHT_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing accidental Night event "${id}".`);
  }

  return definition;
}

function requireItem(
  tribute: GameTribute,
  definitionId: InventoryItem["definitionId"],
): InventoryItem {
  const item = tribute.inventory.find((candidate) => candidate.definitionId === definitionId);

  if (!item) {
    throw new Error(`Missing test item "${definitionId}".`);
  }

  return item;
}

function createState(
  tributes: readonly GameTribute[],
  truceTributeIds: readonly string[] = [],
): GameState {
  const state = {
    ...createAuthoringTestGame(tributes),
    currentRound: NIGHT_ROUND,
  };

  if (truceTributeIds.length < 2) {
    return state;
  }

  return {
    ...state,
    truces: [
      createTruceInstance(
        "accidental-night-test-truce",
        truceTributeIds,
        {
          day: 2,
          period: "day",
        },
        {
          day: 3,
          period: "day",
        },
      ),
    ],
  };
}

function createContext(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  itemsByRole: EventItemsByRole = {},
  randomValue = 0.5,
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state,
    round: NIGHT_ROUND,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => randomValue,
  };
}

describe("accidental fatal Night events", () => {
  it("registers all fifteen night-only fatal definitions", () => {
    expect(ACCIDENTAL_FATAL_NIGHT_EVENTS).toHaveLength(15);
    expect(new Set(ACCIDENTAL_FATAL_NIGHT_EVENTS.map((definition) => definition.id)).size).toBe(15);

    for (const definition of ACCIDENTAL_FATAL_NIGHT_EVENTS) {
      expect(definition.periods).toEqual(["night"]);
      expect(definition.tags).toContain("fatal");
      expect(definition.tags).not.toContain("resource");
      expect(() => validateEventDefinition(definition)).not.toThrow();
    }
  });

  it("credits mistaken dinner without recording an attempted kill", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        name: "Actor",
      }),
      "bow",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
        name: "Target",
      }),
      "blanket",
    );
    const bow = requireItem(actor, "bow");
    const state = createState([actor, target]);
    const definition = requireEvent("night-accidental-mistaken-for-dinner");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: bow,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",
      tributeId: actor.id,
      statistic: "kills",
      amount: 1,
    });
    expect(
      resolution.changes.some(
        (change) => change.type === "increment-statistic" && change.statistic === "attemptedKills",
      ),
    ).toBe(false);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: target.id,
        toTributeId: actor.id,
        reason: "death-loot",
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_ROUND,
      quality: "unsheltered",
    });
  });

  it("credits the startled actor but leaves cliffside inventory behind", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
    });
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
        name: "Target",
      }),
      "knife",
    );
    const state = createState([actor, target]);
    const definition = requireEvent("night-accidental-startled-over-edge");
    const resolution = definition.resolve(
      createContext(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes.some((change) => change.type === "transfer-item")).toBe(false);
  });

  it("lets severe exhaustion cause an unattributed self-fatality", () => {
    const original = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
    });
    const actor = {
      ...original,
      statuses: [
        createStatusEffectInstance("test-exhaustion", original.id, "exhausted", 2, {
          day: 2,
          period: "day",
        }),
      ],
    };
    const state = createState([actor]);
    const definition = requireEvent("night-accidental-sleepwalking-into-river");
    const resolution = definition.resolve(
      createContext(definition, state, {
        actor: [actor],
      }),
    );

    expect(resolution.changes).toEqual([
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [],
      }),
    ]);
    expect(resolution.changes.some((change) => change.type === "record-night-rest")).toBe(false);
  });

  it("conditions smoke-filled shelter toward low-Brains tributes and uses both items", () => {
    let lowBrains = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "low",
        name: "Low",
        stats: {
          brains: 1,
          brawn: 3,
          luck: 3,
        },
      }),
      "tent",
    );
    lowBrains = withAuthoringTestItem(lowBrains, "matches");

    let highBrains = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "high",
        name: "High",
        stats: {
          brains: 5,
          brawn: 3,
          luck: 3,
        },
      }),
      "tent",
    );
    highBrains = withAuthoringTestItem(highBrains, "matches");

    const definition = requireEvent("night-accidental-smoke-filled-shelter");
    const lowState = createState([lowBrains]);
    const highState = createState([highBrains]);

    expect(
      definition.getWeightMultiplier?.({
        state: lowState,
        round: NIGHT_ROUND,
        livingTributes: [lowBrains],
      }),
    ).toBeGreaterThan(
      definition.getWeightMultiplier?.({
        state: highState,
        round: NIGHT_ROUND,
        livingTributes: [highBrains],
      }) ?? 0,
    );

    const matches = requireItem(lowBrains, "matches");
    const resolution = definition.resolve(
      createContext(
        definition,
        lowState,
        {
          actor: [lowBrains],
        },
        {
          actor: [
            {
              userTributeId: lowBrains.id,
              owner: lowBrains,
              item: matches,
            },
          ],
        },
      ),
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "use-item" || change.type === "consume-item",
      ),
    ).toHaveLength(2);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: lowBrains.id,
        killerTributeIds: [],
      }),
    );
  });

  it("credits the kicked log as an accidental kill without an attempt", () => {
    const actor = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
    });
    const target = createAuthoringTestTribute({
      id: "target",
      name: "Target",
    });
    const state = createState([actor, target], [actor.id, target.id]);
    const definition = requireEvent("night-accidental-kicked-burning-log");
    const resolution = definition.resolve(
      createContext(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "increment-statistic",
      tributeId: actor.id,
      statistic: "kills",
      amount: 1,
    });
    expect(
      resolution.changes.some(
        (change) => change.type === "increment-statistic" && change.statistic === "attemptedKills",
      ),
    ).toBe(false);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "break-truce",
        reason: "accidental",
      }),
    );
  });

  it("uses a melee weapon, transfers loot, and breaks the returning watchkeeper truce", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        name: "Actor",
      }),
      "knife",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
        name: "Target",
      }),
      "blanket",
    );
    const knife = requireItem(actor, "knife");
    const state = createState([actor, target], [actor.id, target.id]);
    const definition = requireEvent("night-accidental-returning-watchkeeper");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: knife,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",
        itemInstanceId: knife.id,
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: target.id,
        toTributeId: actor.id,
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "break-truce",
        reason: "accidental",
      }),
    );
  });

  it("does not credit the firewood tree accident", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        name: "Actor",
      }),
      "hand-axe",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
        name: "Target",
      }),
      "blanket",
    );
    const axe = requireItem(actor, "hand-axe");
    const state = createState([actor, target], [actor.id, target.id]);
    const definition = requireEvent("night-accidental-falling-tree-firewood");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: axe,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [],
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "increment-statistic" && change.statistic === "kills",
      ),
    ).toBe(false);
    expect(resolution.changes.some((change) => change.type === "transfer-item")).toBe(false);
  });

  it("leaves the burning blanket with the dead target and uses the fire starter", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        name: "Actor",
      }),
      "matches",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
        name: "Target",
      }),
      "blanket",
    );
    const matches = requireItem(actor, "matches");
    const blanket = requireItem(target, "blanket");
    const state = createState([actor, target], [actor.id, target.id]);
    const definition = requireEvent("night-accidental-burning-blanket-panic");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: matches,
            },
          ],
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item: blanket,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        itemInstanceId: matches.id,
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "transfer-item" && change.itemInstanceId === blanket.id,
      ),
    ).toBe(false);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [],
      }),
    );
  });

  it("uses both melee weapons without recording an attempted kill", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        name: "Actor",
      }),
      "knife",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "target",
        name: "Target",
      }),
      "club",
    );
    const knife = requireItem(actor, "knife");
    const club = requireItem(target, "club");
    const state = createState([actor, target]);
    const definition = requireEvent("night-accidental-both-swing-at-once");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: knife,
            },
          ],
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item: club,
            },
          ],
        },
      ),
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "use-item" || change.type === "consume-item",
      ),
    ).toHaveLength(2);
    expect(
      resolution.changes.some(
        (change) => change.type === "increment-statistic" && change.statistic === "attemptedKills",
      ),
    ).toBe(false);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        itemInstanceId: club.id,
        fromTributeId: target.id,
        toTributeId: actor.id,
      }),
    );
  });
});
