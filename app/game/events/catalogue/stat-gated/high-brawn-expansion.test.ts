import { describe, expect, it } from "vitest";

import { createEventCardPresentation } from "~/features/arena/event-card-presentation";
import { addCornucopiaProvisions } from "~/game/bloodbath/bloodbath-sequencer";
import { applyGameChange } from "~/game/engine/apply-game-change";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import { HIGH_BRAWN_EVENTS } from "~/game/events/catalogue/stat-gated/brawn/high-events";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
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

function requireEvent(definitions: readonly EventDefinition[], id: string): EventDefinition {
  const definition = definitions.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing high-brawn event "${id}".`);
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
    unavailableItemInstanceIds: new Set<string>(),
  };
}

function createTruceState(tributes: readonly GameTribute[]): GameState {
  const state = createAuthoringTestGame([...tributes]);

  return {
    ...state,
    truces: [
      createTruceInstance(
        "high-brawn-test-truce",
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

describe("high-brawn stat-gated expansion", () => {
  it("registers the complete ordinary high-brawn catalogue", () => {
    expect(HIGH_BRAWN_EVENTS).toHaveLength(41);
    expect(new Set(HIGH_BRAWN_EVENTS.map((definition) => definition.id)).size).toBe(41);
  });

  it("preserves the authored item guarantees for First and More Than Your Share", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
        brains: 5,
        luck: 5,
      },
    );
    const state = createAuthoringTestGame([actor]);

    const cases = [
      ["cornucopia-high-brawn-first", 2],
      ["cornucopia-high-brawn-more-than-your-share", 3],
    ] as const;

    for (const [definitionId, expectedItemCount] of cases) {
      const definition = requireEvent(STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS, definitionId);
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
      const acquisitions = resolution.changes.filter((change) => change.type === "acquire-item");

      expect(definition.cornucopiaAcquisitionPolicy?.preserveAuthoredItems, definitionId).toBe(
        true,
      );
      expect(acquisitions, definitionId).toHaveLength(expectedItemCount);
      expect(
        acquisitions.some(
          (change) =>
            change.type === "acquire-item" && change.item.definitionId !== "cornucopia-provisions",
        ),
      ).toBe(true);
    }
  });

  it("keeps Yoink's target empty-handed while provisioning the actor", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
        brains: 5,
        luck: 5,
      },
    );
    const target = withStats(
      createAuthoringTestTribute({
        id: "target",
      }),
      {
        brawn: 1,
      },
    );
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS,
      "cornucopia-high-brawn-yoink",
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
          randomValue: 0.25,
        },
      ),
    );
    const primaryEvent: ResolvedEvent = {
      id: `test:${definition.id}`,
      definitionId: definition.id,
      kind: "primary",
      resolutionMode: "standard",
      feedGroup: "bloodbath-cornucopia",
      round: DAY_ONE,
      participantTributeIds: [actor.id, target.id],
      text: resolution.text,
      changes: resolution.changes,
    };
    const provisionedEvent = addCornucopiaProvisions(primaryEvent, state.tributes, [actor.id]);

    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      preserveAuthoredItems: true,
      provisionRoleIds: ["actor"],
    });
    expect(
      provisionedEvent.changes.filter(
        (change) => change.type === "acquire-item" && change.tributeId === actor.id,
      ),
    ).toHaveLength(3);
    expect(
      provisionedEvent.changes.some(
        (change) => change.type === "acquire-item" && change.tributeId === target.id,
      ),
    ).toBe(false);
    expect(
      provisionedEvent.changes.some(
        (change) => change.type === "satisfy-survival-need" && change.tributeId === target.id,
      ),
    ).toBe(false);
  });

  it("destroys the selected melee weapon without consuming a reusable use", () => {
    const actor = withAuthoringTestItem(
      withStats(
        createAuthoringTestTribute({
          id: "actor",
        }),
        {
          brawn: 5,
        },
      ),
      "club",
    );
    const weapon = actor.inventory[0];

    if (!weapon) {
      throw new Error("Missing melee weapon fixture.");
    }

    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(HIGH_BRAWN_EVENTS, "high-brawn-built-strong-assembled-poorly");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
        },
        {
          itemsByRole: {
            actor: [
              {
                userTributeId: actor.id,
                owner: actor,
                item: weapon,
              },
            ],
          },
        },
      ),
    );

    const destroyChange = resolution.changes.find((change) => change.type === "destroy-item");

    expect(destroyChange).toEqual({
      type: "destroy-item",
      tributeId: actor.id,
      itemInstanceId: weapon.id,
      reason: `test:${definition.id}`,
    });
    expect(resolution.changes.some((change) => change.type === "consume-item")).toBe(false);

    if (!destroyChange || destroyChange.type !== "destroy-item") {
      throw new Error("Missing destroy-item change.");
    }

    const event: ResolvedEvent = {
      id: `test:${definition.id}`,
      definitionId: definition.id,
      kind: "primary",
      resolutionMode: "standard",
      round: DAY_TWO,
      participantTributeIds: [actor.id],
      text: resolution.text,
      changes: resolution.changes,
    };
    const appliedState = applyGameChange(state, destroyChange, event);
    const presentation = createEventCardPresentation(event, state.tributes);

    expect(appliedState.tributes[0]?.inventory).toEqual([]);
    expect(appliedState.itemTransactions).toContainEqual(
      expect.objectContaining({
        type: "destroyed",
        tributeId: actor.id,
        itemInstanceId: weapon.id,
        definitionId: "club",
        uses: null,
      }),
    );
    expect(presentation.itemChanges).toContainEqual(
      expect.objectContaining({
        kind: "destroyed",
        tributeName: actor.snapshot.name,
        itemLabel: "Club",
      }),
    );
  });

  it("satisfies food and water through Uprooted and Pump Action", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
      },
    );
    const state = createAuthoringTestGame([actor]);

    const cases = [
      ["high-brawn-uprooted", "food"],
      ["high-brawn-pump-action", "water"],
    ] as const;

    for (const [definitionId, need] of cases) {
      const definition = requireEvent(HIGH_BRAWN_EVENTS, definitionId);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
        }),
      );

      expect(resolution.changes, definitionId).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: actor.id,
        need,
      });
    }
  });

  it("gives only the sleeping wrecking ball a rest result", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
      },
    );
    const mate = createAuthoringTestTribute({
      id: "mate",
    });
    const state = createTruceState([actor, mate]);
    const definition = requireEvent(HIGH_BRAWN_EVENTS, "high-brawn-sleep-wrecking-ball-2");
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

    expect(resolution.changes.filter((change) => change.type === "record-night-rest")).toEqual([
      {
        type: "record-night-rest",
        tributeId: actor.id,
        round: NIGHT_TWO,
        quality: "comfortable",
      },
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

  it("transfers a truce's inventory before the Union Dispute breakup", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
      },
    );
    const mate = withAuthoringTestItem(
      withAuthoringTestItem(
        createAuthoringTestTribute({
          id: "mate",
        }),
        "map",
      ),
      "knife",
    );
    const state = createTruceState([actor, mate]);
    const definition = requireEvent(HIGH_BRAWN_EVENTS, "high-brawn-union-dispute-2");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        members: [mate],
      }),
    );

    expect(resolution.changes.filter((change) => change.type === "transfer-item")).toHaveLength(2);
    expect(resolution.changes).toContainEqual({
      type: "break-truce",
      truceId: "high-brawn-test-truce:truce",
      reason: "betrayal",
    });
  });

  it("lets Titans resolve either fighter as the winner", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
      },
    );
    const target = withStats(
      createAuthoringTestTribute({
        id: "target",
      }),
      {
        brawn: 5,
      },
    );
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(HIGH_BRAWN_EVENTS, "high-brawn-titans");

    const actorWin = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          randomValue: 0.49,
        },
      ),
    );
    const targetWin = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          randomValue: 0.5,
        },
      ),
    );

    expect(actorWin.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(targetWin.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [target.id],
      }),
    );
  });

  it("kills a truce member without duplicating the dissolution change", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
      },
    );
    const mate = createAuthoringTestTribute({
      id: "mate",
    });
    const state = createTruceState([actor, mate]);
    const definition = requireEvent(HIGH_BRAWN_EVENTS, "high-brawn-restructuring-the-truce-2");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        members: [mate],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: mate.id,
        killerTributeIds: [actor.id],
      }),
    );
    expect(resolution.changes.some((change) => change.type === "break-truce")).toBe(false);
  });

  it("forms the Gentle Giant truce in ordinary and fleeing catalogues", () => {
    const actor = withStats(
      createAuthoringTestTribute({
        id: "actor",
      }),
      {
        brawn: 5,
      },
    );
    const target = withStats(
      createAuthoringTestTribute({
        id: "target",
      }),
      {
        brawn: 1,
      },
    );
    const fillers = Array.from(
      {
        length: 5,
      },
      (_, index) =>
        createAuthoringTestTribute({
          id: `filler-${index}`,
        }),
    );
    const state = createAuthoringTestGame([actor, target, ...fillers]);
    const definitions = [
      requireEvent(HIGH_BRAWN_EVENTS, "high-brawn-gentle-giant"),
      requireEvent(STAT_GATED_FLEE_EVENTS, "bloodbath-flee-high-brawn-gentle-giant"),
    ];

    for (const definition of definitions) {
      const resolution = definition.resolve(
        context(
          definition,
          state,
          {
            actor: [actor],
            target: [target],
          },
          {
            round: definition.id.startsWith("bloodbath") ? DAY_ONE : DAY_TWO,
          },
        ),
      );

      expect(resolution.changes, definition.id).toContainEqual(
        expect.objectContaining({
          type: "form-truce",
          truce: expect.objectContaining({
            tributeIds: [actor.id, target.id],
          }),
        }),
      );
    }
  });
});
