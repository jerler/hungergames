import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { HIGH_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/high-events";
import { LOW_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/low-events";
import { HIGH_BRAWN_EVENTS } from "~/game/events/catalogue/stat-gated/brawn/high-events";
import { LOW_BRAWN_EVENTS } from "~/game/events/catalogue/stat-gated/brawn/low-events";
import { LOW_LUCK_EVENTS } from "~/game/events/catalogue/stat-gated/luck/low-events";
import { MIXED_STAT_GATED_EVENTS } from "~/game/events/catalogue/stat-gated/mixed-events";
import {
  STAT_GATED_BLOODBATH_EVENTS,
  STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES,
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";
import { prepareRound } from "~/game/survival/round-preparation";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const DAY_FOUR = {
  day: 4,
  period: "day",
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

function withStatus(
  tribute: GameTribute,
  statusId: "injured" | "bleeding" | "poisoned" | "burned" | "hungry",
): GameTribute {
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
    throw new Error(`Missing stat-gated event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  randomValue = 0.5,
  round: RoundReference = DAY_TWO,
  itemsByRole?: EventResolutionContext["itemsByRole"],
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: round,
    },
    round,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => randomValue,
  };
}

describe("stat-gated catalogue expansion", () => {
  it("registers 155 concepts as 199 unique definitions", () => {
    expect(LOW_BRAWN_EVENTS).toHaveLength(25);
    expect(HIGH_BRAWN_EVENTS).toHaveLength(41);
    expect(LOW_BRAINS_EVENTS).toHaveLength(29);
    expect(HIGH_BRAINS_EVENTS).toHaveLength(42);
    expect(MIXED_STAT_GATED_EVENTS).toHaveLength(3);
    expect(LOW_LUCK_EVENTS).toHaveLength(13);
    expect(STAT_GATED_BLOODBATH_EVENTS).toHaveLength(46);
    expect(STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS).toHaveLength(16);
    expect(STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES).toHaveLength(14);
    expect(STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS).toHaveLength(3);
    expect(STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS).toHaveLength(1);
    expect(STAT_GATED_FLEE_EVENTS).toHaveLength(12);

    const definitions = [
      ...LOW_BRAWN_EVENTS,
      ...HIGH_BRAWN_EVENTS,
      ...LOW_BRAINS_EVENTS,
      ...HIGH_BRAINS_EVENTS,
      ...MIXED_STAT_GATED_EVENTS,
      ...LOW_LUCK_EVENTS,
      ...STAT_GATED_BLOODBATH_EVENTS,
    ];

    expect(definitions).toHaveLength(199);
    expect(new Set(definitions.map((definition) => definition.id)).size).toBe(199);
  });

  it("limits Rock and a Hard Place to brawn one or two", () => {
    const low = withStats(createAuthoringTestTribute({ id: "low" }), { brawn: 2 });
    const average = withStats(createAuthoringTestTribute({ id: "average" }), { brawn: 3 });
    const target = createAuthoringTestTribute({
      id: "target",
    });
    const state = createAuthoringTestGame([low, average, target]);
    const definition = requireEvent(LOW_BRAWN_EVENTS, "low-brawn-rock-and-a-hard-place");
    const role = definition.roles[0];

    if (!role?.isEligible) {
      throw new Error("Missing low-brawn eligibility.");
    }

    const roleContext = {
      state,
      round: DAY_TWO,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    expect(role.isEligible(low, roleContext)).toBe(true);
    expect(role.isEligible(average, roleContext)).toBe(false);
  });

  it("keeps automatic medical treatment for low-stat actors", () => {
    const actor = withAuthoringTestItem(
      withStatus(
        withStats(
          createAuthoringTestTribute({
            id: "low-stat-patient",
          }),
          { brawn: 2, brains: 2 },
        ),
        "injured",
      ),
      "med-kit",
    );

    const prepared = prepareRound(createAuthoringTestGame([actor]), DAY_TWO);

    expect(
      prepared.automaticEvents.some((event) => event.preparation?.mechanic === "medical-treatment"),
    ).toBe(true);
    expect(prepared.state.tributes[0]?.statuses).toEqual([]);
    expect(prepared.state.tributes[0]?.inventory).toEqual([
      expect.objectContaining({
        definitionId: "med-kit",
        usesRemaining: 2,
      }),
    ]);
  });

  it("keeps automatic med-kit treatment for ordinary-stat actors", () => {
    const actor = withAuthoringTestItem(
      withStatus(
        withStats(
          createAuthoringTestTribute({
            id: "ordinary-patient",
          }),
          { brawn: 3, brains: 3 },
        ),
        "injured",
      ),
      "med-kit",
    );

    const prepared = prepareRound(createAuthoringTestGame([actor]), DAY_TWO);

    expect(
      prepared.automaticEvents.some((event) => event.preparation?.mechanic === "medical-treatment"),
    ).toBe(true);
  });

  it("consumes a med kit without changing status in the low-brawn event", () => {
    const actor = withAuthoringTestItem(
      withStats(
        createAuthoringTestTribute({
          id: "low-brawn-actor",
          name: "Katniss",
        }),
        { brawn: 1, brains: 3 },
      ),
      "med-kit",
    );
    const medKit = actor.inventory[0];

    if (!medKit) {
      throw new Error("Missing med-kit fixture.");
    }

    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(LOW_BRAWN_EVENTS, "low-brawn-childproofed-medkit");
    const resolution = definition.resolve(
      context(definition, state, { actor: [actor] }, 0.5, DAY_TWO, {
        actor: [
          {
            userTributeId: actor.id,
            owner: actor,
            item: medKit,
          },
        ],
      }),
    );

    expect(resolution.text).toBe(
      "After slicing their arm deeply on a rogue branch, Katniss spends ten humiliating minutes fighting to open the medkit's packaging before finally reaching the supplies inside, muscles crying from the effort.",
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        tributeId: actor.id,
        itemInstanceId: medKit.id,
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "apply-status" || change.type === "remove-status",
      ),
    ).toBe(false);
  });

  it("consumes a med kit without changing status in the low-brains event", () => {
    const actor = withAuthoringTestItem(
      withStats(
        createAuthoringTestTribute({
          id: "low-brains-actor",
          name: "Peeta",
        }),
        { brawn: 3, brains: 1 },
      ),
      "med-kit",
    );
    const medKit = actor.inventory[0];

    if (!medKit) {
      throw new Error("Missing med-kit fixture.");
    }

    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(LOW_BRAINS_EVENTS, "low-brains-childproofed-medkit");
    const resolution = definition.resolve(
      context(definition, state, { actor: [actor] }, 0.5, DAY_TWO, {
        actor: [
          {
            userTributeId: actor.id,
            owner: actor,
            item: medKit,
          },
        ],
      }),
    );

    expect(resolution.text).toBe(
      "After slicing their arm deeply on a rogue branch, Peeta spends ten humiliating minutes trying to figure out how to open the child-proof latch on the medkit's packaging before finally reaching the supplies inside.",
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        tributeId: actor.id,
        itemInstanceId: medKit.id,
      }),
    );
    expect(
      resolution.changes.some(
        (change) => change.type === "apply-status" || change.type === "remove-status",
      ),
    ).toBe(false);
  });

  it("forms the protective high-brawn and low-brawn truce", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 1 });
    const target = withStats(createAuthoringTestTribute({ id: "target" }), { brawn: 5 });
    const filler = createAuthoringTestTribute({
      id: "filler",
    });
    const state = createAuthoringTestGame([actor, target, filler]);
    const definition = requireEvent(LOW_BRAWN_EVENTS, "low-brawn-looking-out-for-the-little-guy");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "form-truce",
        truce: expect.objectContaining({
          tributeIds: [actor.id, target.id],
        }),
      }),
    );
  });

  it("ends a two-person Royal Treatment truce through death aftermath", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 1 });
    const mate = createAuthoringTestTribute({
      id: "mate",
    });
    const baseState = createAuthoringTestGame([actor, mate]);
    const state = {
      ...baseState,
      truces: [
        createTruceInstance(
          "royal-treatment-truce",
          [actor.id, mate.id],
          {
            day: 1,
            period: "night",
          },
          STANDARD_TRUCE_EXPIRY_ROUND,
        ),
      ],
    };
    const definition = requireEvent(LOW_BRAWN_EVENTS, "low-brawn-royal-treatment-fatal-2");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        members: [mate],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [mate.id],
      }),
    );
    expect(resolution.changes.some((change) => change.type === "break-truce")).toBe(false);
  });

  it("records the bridge kill without transferring inventory", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 1 });
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "map");
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(LOW_BRAWN_EVENTS, "low-brawn-bridge-over-troubled-water");
    const resolution = definition.resolve(
      context(definition, state, {
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

  it("limits failed intimidation to Days 2 and 3", () => {
    const definition = requireEvent(LOW_BRAWN_EVENTS, "low-brawn-failed-intimidation");
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 1 });
    const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "knife");
    const state = createAuthoringTestGame([actor, target]);

    expect(
      definition.isEligible?.({
        state,
        round: DAY_TWO,
        livingTributes: state.tributes,
      }),
    ).toBe(true);
    expect(
      definition.isEligible?.({
        state,
        round: DAY_FOUR,
        livingTributes: state.tributes,
      }),
    ).toBe(false);
  });

  it("uses the standard Cornucopia acquisition process for Smarter Not Harder", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 1, brains: 5 });
    const state = createAuthoringTestGame([actor]);
    const definition = STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS.find(
      (candidate) => candidate.id === "cornucopia-smarter-not-harder",
    );

    if (!definition) {
      throw new Error("Missing Smarter Not Harder event.");
    }

    const resolution = definition.resolve(
      context(definition, state, {
        tribute: [actor],
      }),
    );

    expect(resolution.changes.some((change) => change.type === "acquire-item")).toBe(true);
  });

  it("credits the stronger tribute in Shooting Fish in a Barrel", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 1 });
    const target = withStats(createAuthoringTestTribute({ id: "target" }), { brawn: 3 });
    const state = createAuthoringTestGame([actor, target]);
    const definition = STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.find(
      ({ definition: candidate }) =>
        candidate.id === "cornucopia-low-brawn-shooting-fish-in-a-barrel",
    )?.definition;

    if (!definition) {
      throw new Error("Missing Shooting Fish in a Barrel event.");
    }

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
  });

  it("credits the trampling tribute in Run Faster", () => {
    const actor = withStats(createAuthoringTestTribute({ id: "actor" }), { brawn: 2 });
    const target = createAuthoringTestTribute({
      id: "target",
    });
    const state = createAuthoringTestGame([actor, target]);
    const definition = STAT_GATED_FLEE_EVENTS.find(
      (candidate) => candidate.id === "bloodbath-flee-low-brawn-run-faster",
    );

    if (!definition) {
      throw new Error("Missing Run Faster event.");
    }

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
  });
});
