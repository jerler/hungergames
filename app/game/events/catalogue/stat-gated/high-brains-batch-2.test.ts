import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  STAT_GATED_BLOODBATH_EVENTS,
  STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import { HIGH_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/high-events";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

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

function withBrains(tribute: GameTribute, brains: 1 | 2 | 3 | 4 | 5): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      stats: {
        ...tribute.snapshot.stats,
        brains,
      },
    },
  };
}

function withStatus(tribute: GameTribute, statusId: "hungry" | "thirsty"): GameTribute {
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

function withStandardTruce(
  tributes: readonly GameTribute[],
  truceMemberIds = tributes.map((tribute) => tribute.id),
): GameState {
  const state = createAuthoringTestGame(tributes);

  return {
    ...state,
    truces: [
      createTruceInstance(
        "high-brains-batch-2-truce",
        truceMemberIds,
        DAY_ONE,
        STANDARD_TRUCE_EXPIRY_ROUND,
      ),
    ],
  };
}

function requireEvent(definitions: readonly EventDefinition[], id: string): EventDefinition {
  const definition = definitions.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing High-Brains Batch 2 event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  options: {
    round?: RoundReference;
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
    random: () => 0.25,
    unavailableItemInstanceIds: new Set<string>(),
  };
}

describe("High-Brains Batch 2 expansion", () => {
  it("registers all nineteen remaining concepts as thirty-one definitions", () => {
    const ordinaryIds = new Set([
      "high-brains-efficient-shelter",
      "high-brains-alarm-system",
      ...[2, 3, 4, 5, 6].map((size) => `high-brains-sleep-schedule-${size}`),
      ...[2, 3, 4, 5, 6].map((size) => `high-brains-division-of-labour-${size}`),
      "high-brains-useful-idiot",
      ...[3, 4, 5, 6].map((size) => `high-brains-hostile-takeover-${size}`),
      "high-brains-fake-weakness",
      "high-brains-overthinking",
      "high-brains-perfect-plan",
      "high-brains-occupational-hazard",
      "high-brains-seems-suspicious",
      "high-brains-too-clean",
      "high-brains-i-can-fix-it",
      "high-brains-trap-enthusiast",
      "high-brains-just-one-more-adjustment",
      "high-brains-rest-is-inefficient",
      "high-brains-too-clever-by-half",
      "high-brains-predictably-unpredictable",
    ]);
    const bloodbathIds = new Set([
      "cornucopia-high-brains-decision-paralysis",
      "bloodbath-flee-high-brains-decision-paralysis",
    ]);

    expect(ordinaryIds.size).toBe(29);
    expect(HIGH_BRAINS_EVENTS.filter((definition) => ordinaryIds.has(definition.id))).toHaveLength(
      29,
    );
    expect(
      STAT_GATED_BLOODBATH_EVENTS.filter((definition) => bloodbathIds.has(definition.id)),
    ).toHaveLength(2);
    expect(HIGH_BRAINS_EVENTS).toHaveLength(42);
    expect(STAT_GATED_BLOODBATH_EVENTS).toHaveLength(28);
  });

  it("gives Alarm System sheltered rest and alertness", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-alarm-system");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
        },
        {
          round: NIGHT_TWO,
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "record-night-rest",
        tributeId: actor.id,
        quality: "sheltered",
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({ definitionId: "alert" }),
      }),
    );
  });

  it("gives every truce member sheltered rest through Sleep Schedule", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const first = createAuthoringTestTribute({ id: "first" });
    const second = createAuthoringTestTribute({ id: "second" });
    const state = withStandardTruce([actor, first, second]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-sleep-schedule-3");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          members: [first, second],
        },
        {
          round: NIGHT_TWO,
        },
      ),
    );

    expect(resolution.changes.filter((change) => change.type === "record-night-rest")).toEqual([
      expect.objectContaining({ tributeId: actor.id, quality: "sheltered" }),
      expect.objectContaining({ tributeId: first.id, quality: "sheltered" }),
      expect.objectContaining({ tributeId: second.id, quality: "sheltered" }),
    ]);
  });

  it("satisfies food and water for every Division of Labour member", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const first = createAuthoringTestTribute({ id: "first" });
    const second = createAuthoringTestTribute({ id: "second" });
    const state = withStandardTruce([actor, first, second]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-division-of-labour-3");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        members: [first, second],
      }),
    );

    expect(
      resolution.changes.filter((change) => change.type === "satisfy-survival-need"),
    ).toHaveLength(6);
    expect(
      resolution.changes.filter(
        (change) => change.type === "apply-status" && change.status.definitionId === "well-rested",
      ),
    ).toHaveLength(3);
  });

  it("lets Useful Idiot steal from the mate while crediting the outside killer", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const mate = withAuthoringTestItem(
      withBrains(createAuthoringTestTribute({ id: "mate" }), 3),
      "map",
    );
    const target = createAuthoringTestTribute({ id: "target" });
    const state = withStandardTruce([actor, mate, target], [actor.id, mate.id]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-useful-idiot");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        trucemate: [mate],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: mate.id,
        killerTributeIds: [target.id],
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "transfer-item",
        fromTributeId: mate.id,
        toTributeId: actor.id,
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "break-truce",
        reason: "betrayal",
      }),
    );
    const transferIndex = resolution.changes.findIndex((change) => change.type === "transfer-item");
    const eliminationIndex = resolution.changes.findIndex(
      (change) => change.type === "eliminate-tribute",
    );

    expect(transferIndex).toBeGreaterThanOrEqual(0);
    expect(eliminationIndex).toBeGreaterThan(transferIndex);
  });

  it("kills every other member and collects their inventory through Hostile Takeover", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const first = withAuthoringTestItem(createAuthoringTestTribute({ id: "first" }), "map");
    const second = withAuthoringTestItem(createAuthoringTestTribute({ id: "second" }), "knife");
    const state = withStandardTruce([actor, first, second]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-hostile-takeover-3");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        members: [first, second],
      }),
    );

    expect(resolution.changes.filter((change) => change.type === "eliminate-tribute")).toEqual([
      expect.objectContaining({
        tributeId: first.id,
        killerTributeIds: [actor.id],
      }),
      expect.objectContaining({
        tributeId: second.id,
        killerTributeIds: [actor.id],
      }),
    ]);
    expect(
      resolution.changes.filter(
        (change) => change.type === "transfer-item" && change.toTributeId === actor.id,
      ),
    ).toHaveLength(2);
  });

  it("destroys the selected weapon through I Can Fix It", () => {
    const actor = withAuthoringTestItem(
      withBrains(createAuthoringTestTribute({ id: "actor" }), 5),
      "knife",
    );
    const weapon = actor.inventory[0];

    if (!weapon) {
      throw new Error("Missing weapon fixture.");
    }

    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-i-can-fix-it");
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

    expect(resolution.changes).toContainEqual({
      type: "destroy-item",
      tributeId: actor.id,
      itemInstanceId: weapon.id,
      reason: `test:${definition.id}`,
    });
  });

  it("records unsheltered rest and exhaustion through Rest Is Inefficient", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-rest-is-inefficient");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
        },
        {
          round: NIGHT_TWO,
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "record-night-rest",
        tributeId: actor.id,
        quality: "unsheltered",
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({ definitionId: "exhausted" }),
      }),
    );
  });

  it("keeps suspicious tributes hungry and thirsty", () => {
    const hungry = withStatus(
      withBrains(createAuthoringTestTribute({ id: "hungry" }), 5),
      "hungry",
    );
    const thirsty = withStatus(
      withBrains(createAuthoringTestTribute({ id: "thirsty" }), 4),
      "thirsty",
    );
    const state = createAuthoringTestGame([hungry, thirsty]);

    for (const [id, actor] of [
      ["high-brains-seems-suspicious", hungry],
      ["high-brains-too-clean", thirsty],
    ] as const) {
      const definition = requireEvent(HIGH_BRAINS_EVENTS, id);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
        }),
      );

      expect(resolution.changes.some((change) => change.type === "satisfy-survival-need")).toBe(
        false,
      );
    }
  });

  it("registers both Decision Paralysis deaths", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const state = createAuthoringTestGame([actor]);
    const cornucopia = requireEvent(
      STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition }) => definition),
      "cornucopia-high-brains-decision-paralysis",
    );
    const fleeing = requireEvent(
      STAT_GATED_FLEE_EVENTS,
      "bloodbath-flee-high-brains-decision-paralysis",
    );

    for (const definition of [cornucopia, fleeing]) {
      const resolution = definition.resolve(
        context(
          definition,
          state,
          {
            actor: [actor],
          },
          {
            round: DAY_ONE,
          },
        ),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: actor.id,
          killerTributeIds: [],
        }),
      );
    }
  });

  it("credits low-Brains targets for both reversed fatal plans", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const target = withBrains(createAuthoringTestTribute({ id: "target" }), 1);
    const state = createAuthoringTestGame([actor, target]);

    for (const id of ["high-brains-too-clever-by-half", "high-brains-predictably-unpredictable"]) {
      const definition = requireEvent(HIGH_BRAINS_EVENTS, id);
      const resolution = definition.resolve(
        context(definition, state, {
          actor: [actor],
          target: [target],
        }),
      );

      expect(resolution.changes).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: actor.id,
          killerTributeIds: [target.id],
        }),
      );
    }
  });

  it("keeps romantic truces out of every size-specific standard-truce event", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const mate = createAuthoringTestTribute({ id: "mate" });
    const baseState = createAuthoringTestGame([actor, mate]);
    const romanticTruce = createTruceInstance(
      "romantic-high-brains-test",
      [actor.id, mate.id],
      DAY_ONE,
      null,
      "romantic",
    );
    const state = {
      ...baseState,
      truces: [romanticTruce],
    };

    for (const id of [
      "high-brains-sleep-schedule-2",
      "high-brains-division-of-labour-2",
      "high-brains-useful-idiot",
    ]) {
      const definition = requireEvent(HIGH_BRAINS_EVENTS, id);
      const actorRole = definition.roles[0];

      expect(
        actorRole?.isEligible?.(actor, {
          state,
          round: DAY_TWO,
          livingTributes: state.tributes,
          participantsByRole: {},
        }),
      ).toBe(false);
    }
  });

  it("does not accidentally reuse a current truce member as Useful Idiot's target", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const mate = withBrains(createAuthoringTestTribute({ id: "mate" }), 2);
    const state = withStandardTruce([actor, mate]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-useful-idiot");
    const targetRole = definition.roles.find((role) => role.id === "target");

    expect(
      targetRole?.isEligible?.(mate, {
        state,
        round: DAY_TWO,
        livingTributes: state.tributes,
        participantsByRole: {
          actor: [actor],
          trucemate: [mate],
        },
      }),
    ).toBe(false);
    expect(getActiveTruceForTribute(state, actor.id)?.kind).toBe("standard");
  });
});
