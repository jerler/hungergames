import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES,
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import { LOW_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/low-events";
import { getActiveTruceOfSize } from "~/game/events/catalogue/stat-gated/stat-gated-helpers";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type {
  GameState,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function withStats(
  tribute: GameTribute,
  stats: {
    brains?: 1 | 2 | 3 | 4 | 5;
    brawn?: 1 | 2 | 3 | 4 | 5;
    luck?: 1 | 2 | 3 | 4 | 5;
  },
): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      stats: {
        ...tribute.snapshot.stats,
        ...stats,
      },
    },
  };
}

function withStatus(tribute: GameTribute, statusId: StatusEffectId): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance(
        `fixture:${tribute.id}:${statusId}`,
        tribute.id,
        statusId,
        1,
        DAY_TWO,
      ),
    ],
  };
}

function requireEvent(definitions: readonly EventDefinition[], id: string): EventDefinition {
  const definition = definitions.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing low-brains event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  options: {
    round?: RoundReference;
    randomValue?: number;
    itemsByRole?: EventResolutionContext["itemsByRole"];
    unavailableItemInstanceIds?: ReadonlySet<string>;
  } = {},
): EventResolutionContext {
  const round = options.round ?? DAY_TWO;

  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: round,
    },
    round,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole: options.itemsByRole,
    random: () => options.randomValue ?? 0.5,
    unavailableItemInstanceIds: options.unavailableItemInstanceIds ?? new Set<string>(),
  };
}

function createTruceState(tributes: readonly GameTribute[]): GameState {
  const state = createAuthoringTestGame([...tributes]);

  return {
    ...state,
    truces: [
      createTruceInstance(
        "low-brains-test-truce",
        tributes.map((tribute) => tribute.id),
        {
          day: 1,
          period: "night",
        },
        STANDARD_TRUCE_EXPIRY_ROUND,
      ),
    ],
  };
}

function selectOwnedItem(owner: GameTribute, item: InventoryItem) {
  return {
    userTributeId: owner.id,
    owner,
    item,
  };
}

describe("low-brains stat-gated expansion", () => {
  it("registers the complete ordinary low-brains catalogue", () => {
    expect(LOW_BRAINS_EVENTS).toHaveLength(29);
    expect(new Set(LOW_BRAINS_EVENTS.map((definition) => definition.id)).size).toBe(29);
  });

  it("keeps romantic truces out of standard truce event eligibility", () => {
    const first = createAuthoringTestTribute({ id: "first" });
    const second = createAuthoringTestTribute({ id: "second" });
    const baseState = createAuthoringTestGame([first, second]);
    const standardTruce = createTruceInstance(
      "standard-truce-test",
      [first.id, second.id],
      DAY_TWO,
      STANDARD_TRUCE_EXPIRY_ROUND,
    );
    const romanticTruce = {
      ...standardTruce,
      id: "romantic-truce-test",
      kind: "romantic" as const,
      expiresAfterRound: null,
    };

    expect(
      getActiveTruceOfSize(
        {
          ...baseState,
          truces: [standardTruce],
        },
        first.id,
        2,
      ),
    ).toEqual(standardTruce);

    expect(
      getActiveTruceOfSize(
        {
          ...baseState,
          truces: [romanticTruce],
        },
        first.id,
        2,
      ),
    ).toBeNull();
  });

  it("registers all five low-brains Bloodbath definitions", () => {
    expect(STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS.map((definition) => definition.id)).toEqual(
      expect.arrayContaining([
        "cornucopia-low-brains-ooh-shiny",
        "cornucopia-low-brains-pointy-end",
      ]),
    );
    expect(
      STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition }) => definition.id),
    ).toEqual(
      expect.arrayContaining([
        "cornucopia-low-brains-just-one-more-thing",
        "cornucopia-low-brains-not-a-box",
      ]),
    );
    expect(STAT_GATED_FLEE_EVENTS.map((definition) => definition.id)).toContain(
      "bloodbath-flee-low-brains-follow-that-tribute",
    );
  });

  it("leaves Ooh, Shiny empty-handed and unprovisioned", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor", name: "Peeta" }), {
      brains: 1,
    });
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
      "cornucopia-low-brains-ooh-shiny",
    );
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          tribute: [actor],
        },
        {
          round: DAY_ONE,
        },
      ),
    );

    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      provisionRoleIds: [],
    });
    expect(
      resolution.changes.some(
        (change) =>
          change.type === "acquire-item" ||
          change.type === "apply-status" ||
          change.type === "eliminate-tribute",
      ),
    ).toBe(false);
  });

  it("gives Pointy End exactly one weapon and an injury", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), {
      brains: 1,
      brawn: 5,
      luck: 5,
    });
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
      "cornucopia-low-brains-pointy-end",
    );
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          tribute: [actor],
        },
        {
          round: DAY_ONE,
          randomValue: 0.25,
        },
      ),
    );

    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      preserveAuthoredItems: true,
    });
    expect(resolution.changes.filter((change) => change.type === "acquire-item")).toHaveLength(1);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({
          definitionId: "injured",
        }),
      }),
    );
  });

  it("forms a standard truce when following another fleeing tribute", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brains: 1 });
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(
      STAT_GATED_FLEE_EVENTS,
      "bloodbath-flee-low-brains-follow-that-tribute",
    );
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          round: DAY_ONE,
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "form-truce",
        truce: expect.objectContaining({
          kind: "standard",
          tributeIds: [actor.id, target.id],
        }),
      }),
    );
  });

  it("poisons desperate foragers while satisfying the relevant need", () => {
    const hungryActor = withStatus(
      withStats(createAuthoringTestTribute({ id: "hungry" }), { brains: 1 }),
      "hungry",
    );
    const thirstyActor = withStatus(
      withStats(createAuthoringTestTribute({ id: "thirsty" }), { brains: 2 }),
      "thirsty",
    );

    const cases = [
      ["low-brains-natures-snack-bowl", hungryActor, "food"],
      ["low-brains-premium-water", thirstyActor, "water"],
    ] as const;

    for (const [definitionId, actor, need] of cases) {
      const definition = requireEvent(LOW_BRAINS_EVENTS, definitionId);
      const state = createAuthoringTestGame([actor]);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
        }),
      );

      expect(resolution.changes, definitionId).toContainEqual(
        expect.objectContaining({
          type: "apply-status",
          tributeId: actor.id,
          status: expect.objectContaining({
            definitionId: "poisoned",
          }),
        }),
      );
      expect(resolution.changes, definitionId).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: actor.id,
        need,
      });
    }
  });

  it("lets Hansel and Gretel wipe out a truce and loot every member", () => {
    const actor = withAuthoringTestItem(
      withStats(createAuthoringTestTribute({ id: "actor" }), { brains: 1 }),
      "map",
    );
    const mate = withAuthoringTestItem(createAuthoringTestTribute({ id: "mate" }), "knife");
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createTruceState([actor, mate]);
    const stateWithTarget = {
      ...state,
      tributes: [...state.tributes, target],
    };
    const definition = requireEvent(LOW_BRAINS_EVENTS, "low-brains-hansel-and-gretel-truce-2");
    const resolution = definition.resolve(
      context(definition, stateWithTarget, {
        actor: [actor],
        members: [mate],
        target: [target],
      }),
    );

    expect(
      resolution.changes
        .filter((change) => change.type === "eliminate-tribute")
        .map((change) => change.tributeId),
    ).toEqual(expect.arrayContaining([actor.id, mate.id]));
    expect(
      resolution.changes
        .filter((change) => change.type === "transfer-item")
        .map((change) => change.itemInstanceId),
    ).toEqual(expect.arrayContaining([actor.inventory[0]?.id, mate.inventory[0]?.id]));
  });

  it("hands a non-throwable melee weapon directly to its target", () => {
    const actor = withAuthoringTestItem(
      withStats(createAuthoringTestTribute({ id: "actor" }), { brains: 2 }),
      "club",
    );
    const target = createAuthoringTestTribute({ id: "target" });
    const weapon = actor.inventory[0];

    if (!weapon) {
      throw new Error("Missing melee weapon fixture.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(LOW_BRAINS_EVENTS, "low-brains-two-birds-one-weapon");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          itemsByRole: {
            actor: [selectOwnedItem(actor, weapon)],
          },
        },
      ),
    );

    expect(resolution.changes).toContainEqual({
      type: "transfer-item",
      itemInstanceId: weapon.id,
      fromTributeId: actor.id,
      toTributeId: target.id,
      reason: "theft",
    });
  });

  it("destroys the selected item for Weapon Maintenance and Lucky Rock", () => {
    const cases = [
      ["low-brains-weapon-maintenance", "club"],
      ["low-brains-lucky-rock", "map"],
    ] as const;

    for (const [definitionId, itemId] of cases) {
      const actor = withAuthoringTestItem(
        withStats(createAuthoringTestTribute({ id: definitionId }), {
          brains: 1,
        }),
        itemId,
      );
      const item = actor.inventory[0];

      if (!item) {
        throw new Error(`Missing item fixture for ${definitionId}.`);
      }

      const state = createAuthoringTestGame([actor]);
      const definition = requireEvent(LOW_BRAINS_EVENTS, definitionId);
      const resolution = definition.resolve(
        context(
          definition,
          state,
          {
            actor: [actor],
          },
          {
            itemsByRole: {
              actor: [selectOwnedItem(actor, item)],
            },
          },
        ),
      );

      expect(resolution.changes, definitionId).toContainEqual(
        expect.objectContaining({
          type: "destroy-item",
          tributeId: actor.id,
          itemInstanceId: item.id,
        }),
      );
    }
  });

  it("records Watch Duty rest only for the low-brains volunteer", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brains: 1 });
    const mate = createAuthoringTestTribute({ id: "mate" });
    const state = createTruceState([actor, mate]);
    const definition = requireEvent(LOW_BRAINS_EVENTS, "low-brains-watch-duty-2");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          members: [mate],
        },
        {
          round: NIGHT_TWO,
        },
      ),
    );
    const restChanges = resolution.changes.filter((change) => change.type === "record-night-rest");

    expect(restChanges).toEqual([
      expect.objectContaining({
        tributeId: actor.id,
        quality: "comfortable",
      }),
    ]);
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({
          definitionId: "well-rested",
        }),
      }),
    );
  });

  it("transfers the actor's complete inventory through Reverse Psychology", () => {
    const actorWithMap = withAuthoringTestItem(
      withStats(createAuthoringTestTribute({ id: "actor" }), { brains: 1 }),
      "map",
    );
    const actor = withAuthoringTestItem(actorWithMap, "knife");
    const target = createAuthoringTestTribute({ id: "target" });
    const selectedItem = actor.inventory[0];

    if (!selectedItem) {
      throw new Error("Missing reverse-psychology item fixture.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(LOW_BRAINS_EVENTS, "low-brains-reverse-psychology");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          itemsByRole: {
            actor: [selectOwnedItem(actor, selectedItem)],
          },
        },
      ),
    );

    expect(
      resolution.changes
        .filter((change) => change.type === "transfer-item")
        .map((change) => change.itemInstanceId),
    ).toEqual(actor.inventory.map((item) => item.id));
  });

  it("records Warning Shot as an accidental fatality", () => {
    const actor = withAuthoringTestItem(
      withStats(createAuthoringTestTribute({ id: "actor" }), {
        brains: 1,
        luck: 5,
      }),
      "bow",
    );
    const weapon = actor.inventory[0];

    if (!weapon) {
      throw new Error("Missing ranged weapon fixture.");
    }

    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(LOW_BRAINS_EVENTS, "low-brains-warning-shot");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
        },
        {
          itemsByRole: {
            actor: [selectOwnedItem(actor, weapon)],
          },
        },
      ),
    );
    const elimination = resolution.changes.find((change) => change.type === "eliminate-tribute");

    expect(elimination).toEqual(
      expect.objectContaining({
        tributeId: actor.id,
        killerTributeIds: [],
      }),
    );
  });
});
