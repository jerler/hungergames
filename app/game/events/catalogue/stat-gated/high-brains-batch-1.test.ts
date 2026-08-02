import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  STAT_GATED_BLOODBATH_EVENTS,
  STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES,
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
  STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
  STAT_GATED_FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath/stat-gated-events";
import { HIGH_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/high-events";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
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

function withStatus(
  tribute: GameTribute,
  statusId: "hungry" | "thirsty" | "alert" | "hidden" | "poisoned",
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
    throw new Error(`Missing high-Brains event "${id}".`);
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
    random: () => options.randomValue ?? 0.25,
    unavailableItemInstanceIds: new Set<string>(),
  };
}

describe("high-Brains Batch 1 expansion", () => {
  it("keeps Batch 1's thirteen ordinary and nine Bloodbath definitions registered", () => {
    const ordinaryBatchIds = new Set([
      "high-brains-sick-but-smart",
      "high-brains-field-guide",
      "high-brains-clean-enough",
      "high-brains-trail-marker",
      "high-brains-wrong-footprints",
      "high-brains-camp-inspection",
      "high-brains-lead-a-horse-to-water",
      "high-brains-unattended-baggage",
      "high-brains-return-to-sender",
      "high-brains-false-confidence",
      "high-brains-load-bearing-tribute",
      "high-brains-delayed-reaction",
      "high-brains-dose-makes-the-poison",
    ]);

    expect(
      HIGH_BRAINS_EVENTS.filter((definition) => ordinaryBatchIds.has(definition.id)),
    ).toHaveLength(13);

    const batchIds = new Set([
      "cornucopia-high-brains-shopping-list",
      "cornucopia-high-brains-priorities",
      "cornucopia-high-brains-let-them-fight",
      "cornucopia-high-brains-thinking-outside-the-box",
      "cornucopia-high-brains-inventory-management",
      "cornucopia-high-brains-calculated-loss",
      "bloodbath-flee-high-brains-not-my-problem",
      "bloodbath-flee-high-brains-mutual-interest",
      "cornucopia-high-brains-read-the-room",
    ]);

    expect(
      STAT_GATED_BLOODBATH_EVENTS.filter((definition) => batchIds.has(definition.id)),
    ).toHaveLength(9);
    expect(STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS).toHaveLength(12);
    expect(STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES).toHaveLength(10);
    expect(STAT_GATED_CORNUCOPIA_NONFATAL_PAIR_EVENTS).toHaveLength(3);
    expect(STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS).toHaveLength(1);
    expect(STAT_GATED_FLEE_EVENTS).toHaveLength(10);
  });

  it("guarantees two supplies and a weapon through Shopping List", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
      "cornucopia-high-brains-shopping-list",
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
          randomValue: 0.2,
        },
      ),
    );

    expect(resolution.changes.filter((change) => change.type === "acquire-item")).toHaveLength(3);
    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      preserveAuthoredItems: true,
    });
  });

  it("takes the four explicitly prioritized supplies instead of a weapon", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
      "cornucopia-high-brains-priorities",
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

    expect(
      resolution.changes.flatMap((change) =>
        change.type === "acquire-item" ? [change.item.definitionId] : [],
      ),
    ).toEqual(["poison-vial", "med-kit", "energy-drink", "lighter"]);
  });

  it("injures both distracted tributes while provisioning only the planner", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const target = createAuthoringTestTribute({ id: "target" });
    const bystander = createAuthoringTestTribute({ id: "bystander" });
    const state = createAuthoringTestGame([actor, target, bystander]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_NONFATAL_TRIO_EVENTS,
      "cornucopia-high-brains-let-them-fight",
    );
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
          bystander: [bystander],
        },
        {
          round: DAY_ONE,
        },
      ),
    );

    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      provisionRoleIds: ["actor"],
    });
    expect(resolution.changes.filter((change) => change.type === "apply-status")).toEqual([
      expect.objectContaining({
        tributeId: target.id,
        status: expect.objectContaining({ definitionId: "injured" }),
      }),
      expect.objectContaining({
        tributeId: bystander.id,
        status: expect.objectContaining({ definitionId: "injured" }),
      }),
    ]);
  });

  it("reaches both Inventory Management outcomes", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(
      STAT_GATED_CORNUCOPIA_FATAL_TARGET_PROFILES.map(({ definition: candidate }) => candidate),
      "cornucopia-high-brains-inventory-management",
    );

    const success = definition.resolve(
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
    const failure = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        {
          round: DAY_ONE,
          randomValue: 0.75,
        },
      ),
    );

    expect(success.changes.filter((change) => change.type === "acquire-item")).toHaveLength(3);
    expect(definition.cornucopiaAcquisitionPolicy).toEqual({
      preserveAuthoredItems: true,
    });
    expect(failure.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: actor.id,
        killerTributeIds: [target.id],
      }),
    );
  });

  it("satisfies hunger and thirst through the two recovery events", () => {
    const hungry = withStatus(
      withBrains(createAuthoringTestTribute({ id: "hungry" }), 5),
      "hungry",
    );
    const thirsty = withStatus(
      withBrains(createAuthoringTestTribute({ id: "thirsty" }), 4),
      "thirsty",
    );
    const state = createAuthoringTestGame([hungry, thirsty]);

    const fieldGuide = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-field-guide");
    const cleanEnough = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-clean-enough");

    expect(
      fieldGuide.resolve(
        context(fieldGuide, state, {
          actor: [hungry],
        }),
      ).changes,
    ).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: hungry.id,
      need: "food",
    });
    expect(
      cleanEnough.resolve(
        context(cleanEnough, state, {
          actor: [thirsty],
        }),
      ).changes,
    ).toContainEqual({
      type: "satisfy-survival-need",
      tributeId: thirsty.id,
      need: "water",
    });
  });

  it("credits both architects of Lead a Horse to Water", () => {
    const actor = withStatus(withBrains(createAuthoringTestTribute({ id: "actor" }), 5), "hidden");
    const targetOne = createAuthoringTestTribute({ id: "target-one" });
    const targetTwo = createAuthoringTestTribute({ id: "target-two" });
    const state = createAuthoringTestGame([actor, targetOne, targetTwo]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-lead-a-horse-to-water");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          "target-one": [targetOne],
          "target-two": [targetTwo],
        },
        {
          round: NIGHT_TWO,
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: targetTwo.id,
        killerTributeIds: [actor.id, targetOne.id],
      }),
    );
    expect(
      resolution.changes.filter(
        (change) => change.type === "increment-statistic" && change.statistic === "kills",
      ),
    ).toEqual([
      expect.objectContaining({ tributeId: actor.id }),
      expect.objectContaining({ tributeId: targetOne.id }),
    ]);
  });

  it("steals every item through Unattended Baggage", () => {
    const actor = withBrains(createAuthoringTestTribute({ id: "actor" }), 5);
    const target = withAuthoringTestItem(
      withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "map"),
      "knife",
    );
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-unattended-baggage");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes.filter((change) => change.type === "transfer-item")).toHaveLength(2);
  });

  it("clears poisoning through Dose Makes the Poison", () => {
    const actor = withStatus(
      withBrains(createAuthoringTestTribute({ id: "actor" }), 5),
      "poisoned",
    );
    const state = createAuthoringTestGame([actor]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-dose-makes-the-poison");
    const poisonedStatus = actor.statuses.find((status) => status.definitionId === "poisoned");

    if (!poisonedStatus) {
      throw new Error("Missing poisoned fixture.");
    }

    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
      }),
    );

    expect(resolution.changes).toContainEqual({
      type: "remove-status",
      tributeId: actor.id,
      statusId: poisonedStatus.id,
    });
    expect(definition.recoveryProfile).toEqual({
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["poisoned"],
        },
      ],
    });
  });

  it("uses the poison vial and awards the delayed kill", () => {
    const actor = withAuthoringTestItem(
      withBrains(createAuthoringTestTribute({ id: "actor" }), 5),
      "poison-vial",
    );
    const poison = actor.inventory[0];
    const target = createAuthoringTestTribute({ id: "target" });

    if (!poison) {
      throw new Error("Missing poison-vial fixture.");
    }

    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent(HIGH_BRAINS_EVENTS, "high-brains-delayed-reaction");
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
            actor: [
              {
                userTributeId: actor.id,
                owner: actor,
                item: poison,
              },
            ],
          },
        },
      ),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",
        tributeId: actor.id,
        itemInstanceId: poison.id,
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "eliminate-tribute",
        tributeId: target.id,
        killerTributeIds: [actor.id],
      }),
    );
  });
});
