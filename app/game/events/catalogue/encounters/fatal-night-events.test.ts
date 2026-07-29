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
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

import { FATAL_NIGHT_EVENTS } from "./fatal-night-events";

const NIGHT_ROUND = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function requireEvent(id: string): EventDefinition {
  const definition = FATAL_NIGHT_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing fatal Night event "${id}".`);
  }

  return definition;
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
        "night-test-truce",
        truceTributeIds,
        { day: 2, period: "day" },
        { day: 3, period: "day" },
      ),
    ],
  };
}

function createContext(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  itemsByRole: EventItemsByRole = {},
  randomValues: readonly number[] = [0.5],
): EventResolutionContext {
  let randomIndex = 0;

  return {
    eventId: `test:${definition.id}`,
    state,
    round: NIGHT_ROUND,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => randomValues[randomIndex++] ?? 0.5,
  };
}

describe("fatal Night events", () => {
  it("registers all sixteen night-only definitions", () => {
    expect(FATAL_NIGHT_EVENTS).toHaveLength(16);
    expect(new Set(FATAL_NIGHT_EVENTS.map((definition) => definition.id)).size).toBe(16);

    for (const definition of FATAL_NIGHT_EVENTS) {
      expect(definition.periods).toEqual(["night"]);
      expect(definition.tags).toContain("fatal");
      expect(definition.tags).not.toContain("resource");
      expect(() => validateEventDefinition(definition)).not.toThrow();
    }
  });

  it("betrays a standard truce with weapon use, loot, and rest", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "actor", name: "Actor" }),
      "knife",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target", name: "Target" }),
      "blanket",
    );
    const weapon = actor.inventory[0];

    if (!weapon) {
      throw new Error("Test weapon is missing.");
    }

    const state = createState([actor, target], [actor.id, target.id]);
    const definition = requireEvent("night-fatal-betrayal-on-watch");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        { actor: [actor], target: [target] },
        {
          actor: [
            {
              userTributeId: actor.id,
              owner: actor,
              item: weapon,
            },
          ],
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",
        tributeId: actor.id,
        itemInstanceId: weapon.id,
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: target.id,
        toTributeId: actor.id,
        reason: "death-loot",
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "break-truce",
        reason: "betrayal",
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_ROUND,
      quality: "sheltered",
    });
  });

  it("keeps failed tree chopping nonfatal and safety success lethal", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "actor",
        name: "Actor",
        stats: { brains: 3, brawn: 3, luck: 3 },
      }),
      "hand-axe",
    );
    const target = createAuthoringTestTribute({ id: "target", name: "Target" });
    const axe = actor.inventory[0];

    if (!axe) {
      throw new Error("Test axe is missing.");
    }

    const state = createState([actor, target]);
    const definition = requireEvent("night-fatal-chopped-from-tree");
    const itemsByRole = {
      actor: [
        {
          userTributeId: actor.id,
          owner: actor,
          item: axe,
        },
      ],
    };
    const failed = definition.resolve(
      createContext(definition, state, { actor: [actor], target: [target] }, itemsByRole, [0]),
    );
    const successful = definition.resolve({
      ...createContext(definition, state, { actor: [actor], target: [target] }, itemsByRole, [0]),
      resolutionMode: "safety",
    });

    expect(failed.changes.some((change) => change.type === "eliminate-tribute")).toBe(false);
    expect(failed.changes.filter((change) => change.type === "record-night-rest")).toHaveLength(2);
    expect(successful.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
      }),
    );
  });

  it("uses both the bow and fire starter during a firelight ambush", () => {
    const actor = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "actor", name: "Actor" }),
      "bow",
    );
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target", name: "Target" }),
      "matches",
    );
    const bow = actor.inventory[0];
    const matches = target.inventory[0];

    if (!bow || !matches) {
      throw new Error("Firelight test items are missing.");
    }

    const state = createState([actor, target]);
    const definition = requireEvent("night-fatal-firelight-ambush");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        { actor: [actor], target: [target] },
        {
          actor: [{ userTributeId: actor.id, owner: actor, item: bow }],
          target: [{ userTributeId: target.id, owner: target, item: matches }],
        },
      ),
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "use-item" || change.type === "consume-item",
      ),
    ).toHaveLength(2);
    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_ROUND,
      quality: "unsheltered",
    });
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({ definitionId: "hidden" }),
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "transfer-item" && change.itemInstanceId === matches.id,
      ),
    ).toBe(false);
  });

  it("uses target-owned bedding and records comfortable rest", () => {
    const actor = createAuthoringTestTribute({ id: "actor", name: "Actor" });
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target", name: "Target" }),
      "blanket",
    );
    const blanket = target.inventory[0];

    if (!blanket) {
      throw new Error("Test blanket is missing.");
    }

    const state = createState([actor, target], [actor.id, target.id]);
    const definition = requireEvent("night-fatal-smothered-beneath-blanket");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        { actor: [actor], target: [target] },
        {
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
        type: "use-item",
        tributeId: target.id,
        itemInstanceId: blanket.id,
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_ROUND,
      quality: "comfortable",
    });
  });

  it("buries cave-collapse loot with the target", () => {
    const actor = createAuthoringTestTribute({ id: "actor", name: "Actor" });
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target", name: "Target" }),
      "blanket",
    );
    const state = createState([actor, target]);
    const definition = requireEvent("night-fatal-collapsing-cave-entrance");
    const resolution = definition.resolve(
      createContext(definition, state, { actor: [actor], target: [target] }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
      }),
    );
    expect(resolution.changes.some((change) => change.type === "transfer-item")).toBe(false);
  });

  it("uses the target shelter's rest quality after the fake emergency", () => {
    const actor = createAuthoringTestTribute({ id: "actor", name: "Actor" });
    const target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target", name: "Target" }),
      "sleeping-bag",
    );
    const shelter = target.inventory[0];

    if (!shelter) {
      throw new Error("Test shelter is missing.");
    }

    const state = createState([actor, target]);
    const definition = requireEvent("night-fatal-fake-emergency");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        { actor: [actor], target: [target] },
        {
          target: [{ userTributeId: target.id, owner: target, item: shelter }],
        },
      ),
    );

    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_ROUND,
      quality: "comfortable",
    });
  });

  it("removes the sleeping bag from play while transferring other loot", () => {
    let target = withAuthoringTestItem(
      createAuthoringTestTribute({ id: "target", name: "Target" }),
      "sleeping-bag",
    );
    target = withAuthoringTestItem(target, "blanket");
    const actor = createAuthoringTestTribute({
      id: "actor",
      name: "Actor",
      stats: { brains: 3, brawn: 5, luck: 3 },
    });
    const sleepingBag = target.inventory[0];
    const blanket = target.inventory[1];

    if (!sleepingBag || !blanket) {
      throw new Error("Canoe test items are missing.");
    }

    const state = createState([actor, target]);
    const definition = requireEvent("night-fatal-sleeping-bag-canoe");
    const resolution = definition.resolve(
      createContext(
        definition,
        state,
        { actor: [actor], target: [target] },
        {
          target: [
            {
              userTributeId: target.id,
              owner: target,
              item: sleepingBag,
            },
          ],
        },
      ),
    );

    expect(
      resolution.changes.some(
        (change) => change.type === "transfer-item" && change.itemInstanceId === sleepingBag.id,
      ),
    ).toBe(false);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        itemInstanceId: blanket.id,
        fromTributeId: target.id,
        toTributeId: actor.id,
      }),
    );
    expect(resolution.changes).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: actor.id,
      need: "water",
    });
  });
});
