import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";
import { isSuccessfulStatCheckOutcome } from "~/game/events/event-outcomes";

import { resolveNaturalShelterCheck } from "./natural-shelter";
import { createPreparationRandom, createPreparationSeed, prepareRound } from "./round-preparation";

const ROUND = {
  day: 2,
  period: "day",
} as const;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const;

const DAY_THREE = {
  day: 3,
  period: "day",
} as const;

function withStatus(
  tribute: GameTribute,
  statusId:
    | "bleeding"
    | "injured"
    | "poisoned"
    | "burned"
    | "thirsty"
    | "dehydrated"
    | "hungry"
    | "starving",
  durationRounds?: number,
): GameTribute {
  return {
    ...tribute,

    statuses: [
      ...tribute.statuses,

      createStatusEffectInstance(
        `status-${statusId}`,
        tribute.id,
        statusId,
        1,
        ROUND,
        durationRounds,
      ),
    ],
  };
}

function createDeadTestTribute(tribute: GameTribute): GameTribute {
  return {
    ...tribute,

    isAlive: false,

    death: {
      round: NIGHT_TWO,

      causeId: "test-death",

      causeLabel: "Test death",

      summary: "dies during a test.",

      killerTributeIds: [],

      resolvedEventId: "test-death-event",
    },
  };
}

describe("prepareRound", () => {
  it("visibly applies specific medical treatment", () => {
    let tribute = createAuthoringTestTribute({
      id: "patient",
      name: "Katniss",
    });

    tribute = withStatus(tribute, "bleeding", 1);

    tribute = withStatus(tribute, "injured");

    tribute = withAuthoringTestItem(tribute, "bandages");

    const bandages = tribute.inventory[0];

    if (!bandages) {
      throw new Error("Expected a bandages fixture.");
    }

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      ROUND,
    );

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]).toMatchObject({
      kind: "preparation",

      preparation: {
        mechanic: "medical-treatment",

        actingTributeId: tribute.id,

        itemDefinitionId: "bandages",

        itemOwnerTributeId: tribute.id,

        itemInstanceId: bandages.id,

        usesRemainingAfter: 0,

        affectedStatusIds: ["bleeding", "injured"],
      },
    });

    expect(prepared.state.tributes[0].statuses).toEqual([]);

    expect(prepared.state.tributes[0].inventory).toEqual([]);

    expect(prepared.committedItemInstanceIds).toContain(bandages.id);
  });

  it("treats a nonfatal medical condition", () => {
    let tribute = createAuthoringTestTribute({
      id: "burn-patient",
    });

    tribute = withStatus(tribute, "burned");

    tribute = withAuthoringTestItem(tribute, "burn-kit");

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      ROUND,
    );

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0].preparation).toMatchObject({
      mechanic: "medical-treatment",

      itemDefinitionId: "burn-kit",

      affectedStatusIds: ["burned"],
    });

    expect(prepared.state.tributes[0].statuses).toEqual([]);
  });

  it("resolves hydration before food", () => {
    let tribute: GameTribute = {
      ...createAuthoringTestTribute(),

      survival: {
        roundsWithoutFood: 3,
        roundsWithoutWater: 4,
        lastNightRest: null,
      },
    };

    tribute = withStatus(tribute, "dehydrated");

    tribute = withStatus(tribute, "hungry");

    tribute = withAuthoringTestItem(tribute, "water");

    tribute = withAuthoringTestItem(tribute, "wild-fruit");

    const prepared = prepareRound(createAuthoringTestGame([tribute]), ROUND);

    expect(prepared.events.map((event) => event.preparation?.mechanic)).toEqual([
      "hydration-consumption",
      "food-consumption",
    ]);

    const preparedTribute = prepared.state.tributes[0];

    expect(preparedTribute.survival.roundsWithoutWater).toBe(0);

    expect(preparedTribute.survival.roundsWithoutFood).toBe(0);

    expect(preparedTribute.statuses).toEqual([]);
  });

  it("shows borrowed medical treatment in preparation text", () => {
    let patient = createAuthoringTestTribute({
      id: "patient",
      name: "Katniss",
    });

    patient = {
      ...patient,
      district: 1,
      districtPosition: 1,
    };

    patient = withStatus(patient, "poisoned", 1);

    let owner = createAuthoringTestTribute({
      id: "owner",
      name: "Peeta",
    });

    owner = {
      ...owner,
      district: 1,
      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "antidote");

    const game: GameState = {
      ...createAuthoringTestGame([patient, owner]),

      truces: [
        createTruceInstance(
          "preparation-truce",

          [patient.id, owner.id],

          ROUND,

          {
            day: 3,
            period: "day",
          },
        ),
      ],
    };

    const prepared = prepareRound(game, ROUND);

    const event = prepared.events[0];

    expect(event.text).toBe("Katniss uses Peeta's antidote to treat their poisoning.");

    expect(event.preparation).toMatchObject({
      mechanic: "medical-treatment",

      actingTributeId: patient.id,

      itemDefinitionId: "antidote",

      itemOwnerTributeId: owner.id,
    });

    expect(event.changes).toContainEqual(
      expect.objectContaining({
        type: "consume-item",

        tributeId: owner.id,
      }),
    );

    expect(prepared.state.tributes.find((tribute) => tribute.id === owner.id)?.inventory).toEqual(
      [],
    );
  });

  it("does not let one shared item prepare two tributes", () => {
    let first = createAuthoringTestTribute({
      id: "first",
    });

    first = {
      ...first,
      district: 1,
      districtPosition: 1,
    };

    first = withStatus(first, "thirsty");

    first = withAuthoringTestItem(first, "water");

    let second = createAuthoringTestTribute({
      id: "second",
    });

    second = {
      ...second,
      district: 1,
      districtPosition: 2,
    };

    second = withStatus(second, "thirsty");

    const game: GameState = {
      ...createAuthoringTestGame([first, second]),

      truces: [
        createTruceInstance("shared-water-truce", [first.id, second.id], ROUND, {
          day: 3,
          period: "day",
        }),
      ],
    };

    const prepared = prepareRound(game, ROUND);

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0].preparation?.actingTributeId).toBe(first.id);
  });

  it("uses isolated deterministic preparation seeds", () => {
    const firstSeed = createPreparationSeed(
      "game-seed",
      ROUND,
      "hydration-consumption",
      "tribute-1",
    );

    expect(createPreparationSeed("game-seed", ROUND, "hydration-consumption", "tribute-1")).toBe(
      firstSeed,
    );

    expect(createPreparationSeed("game-seed", ROUND, "food-consumption", "tribute-1")).not.toBe(
      firstSeed,
    );

    expect(
      createPreparationSeed("game-seed", ROUND, "hydration-consumption", "tribute-2"),
    ).not.toBe(firstSeed);
  });
  it("records comfortable night rest with reusable equipment", () => {
    let tribute = createAuthoringTestTribute({
      id: "sleeper",
    });

    tribute = withAuthoringTestItem(tribute, "blanket");

    const blanket = tribute.inventory[0];

    if (!blanket) {
      throw new Error("Expected a blanket fixture.");
    }

    const prepared = prepareRound(createAuthoringTestGame([tribute]), NIGHT_TWO);

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]).toMatchObject({
      kind: "preparation",

      preparation: {
        mechanic: "night-rest-preparation",

        actingTributeId: tribute.id,
        itemInstanceId: blanket.id,
        itemOwnerTributeId: tribute.id,

        usesRemainingAfter: null,
        restQuality: "comfortable",
      },
    });

    expect(prepared.state.tributes[0].survival.lastNightRest).toEqual({
      round: NIGHT_TWO,
      quality: "comfortable",
    });

    expect(prepared.state.tributes[0].inventory).toContainEqual(blanket);

    expect(prepared.committedItemInstanceIds).toContain(blanket.id);
  });

  it("attempts deterministic natural shelter when no equipment is available", () => {
    const tribute = createAuthoringTestTribute({
      id: "natural-sleeper",
    });

    const game = createAuthoringTestGame([tribute]);

    const expectedOutcome = resolveNaturalShelterCheck(
      tribute,

      createPreparationRandom(game.seed, NIGHT_TWO, "night-rest-preparation", tribute.id),
    );

    const expectedQuality = isSuccessfulStatCheckOutcome(expectedOutcome)
      ? "sheltered"
      : "unsheltered";

    const prepared = prepareRound(game, NIGHT_TWO);

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]).toMatchObject({
      kind: "preparation",

      preparation: {
        mechanic: "night-rest-preparation",

        actingTributeId: tribute.id,

        restQuality: expectedQuality,
      },
    });

    expect(prepared.events[0]?.preparation?.itemInstanceId).toBeUndefined();

    expect(prepared.state.tributes[0]?.survival.lastNightRest).toEqual({
      round: NIGHT_TWO,
      quality: expectedQuality,
    });
  });

  it("gives sheltered sleep no morning benefit or penalty", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "sheltered-tribute",
    });

    const exhausted = createStatusEffectInstance(
      "existing-exhaustion",
      baseTribute.id,
      "exhausted",
      1,
      NIGHT_TWO,
    );

    const tribute: GameTribute = {
      ...baseTribute,

      statuses: [exhausted],

      survival: {
        ...baseTribute.survival,

        lastNightRest: {
          round: NIGHT_TWO,
          quality: "sheltered",
        },
      },
    };

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      DAY_THREE,
    );

    expect(prepared.events[0]?.preparation).toMatchObject({
      mechanic: "morning-rest-resolution",

      restQuality: "sheltered",
      affectedStatusIds: [],
    });

    expect(prepared.events[0]?.changes).toEqual([]);

    expect(prepared.state.tributes[0]?.statuses).toEqual([exhausted]);
  });

  it("reserves one shared rest item for only one tribute", () => {
    let first = createAuthoringTestTribute({
      id: "first-sleeper",
    });

    first = {
      ...first,
      district: 1,
      districtPosition: 1,
    };

    let owner = createAuthoringTestTribute({
      id: "blanket-owner",
    });

    owner = {
      ...owner,
      district: 1,
      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "blanket");

    const blanket = owner.inventory[0];

    if (!blanket) {
      throw new Error("Expected a blanket fixture.");
    }

    const game: GameState = {
      ...createAuthoringTestGame([first, owner]),

      truces: [
        createTruceInstance("shared-blanket-truce", [first.id, owner.id], NIGHT_TWO, {
          day: 3,
          period: "night",
        }),
      ],
    };

    const prepared = prepareRound(game, NIGHT_TWO);

    const ownerNaturalShelterOutcome = resolveNaturalShelterCheck(
      owner,
      createPreparationRandom(game.seed, NIGHT_TWO, "night-rest-preparation", owner.id),
    );

    const ownerExpectedQuality = isSuccessfulStatCheckOutcome(ownerNaturalShelterOutcome)
      ? "sheltered"
      : "unsheltered";

    expect(
      prepared.events.map((event) => ({
        tributeId: event.preparation?.actingTributeId,

        quality: event.preparation?.restQuality,

        itemOwner: event.preparation?.itemOwnerTributeId,
      })),
    ).toEqual([
      {
        tributeId: first.id,
        quality: "comfortable",
        itemOwner: owner.id,
      },
      {
        tributeId: owner.id,
        quality: ownerExpectedQuality,
        itemOwner: undefined,
      },
    ]);

    expect(prepared.committedItemInstanceIds).toEqual(new Set([blanket.id]));
  });

  it("turns comfortable sleep into well-rested and removes exhaustion", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "rested-tribute",
    });

    const exhausted = createStatusEffectInstance(
      "existing-exhaustion",
      baseTribute.id,
      "exhausted",
      2,
      NIGHT_TWO,
    );

    const tribute: GameTribute = {
      ...baseTribute,

      statuses: [exhausted],

      survival: {
        ...baseTribute.survival,

        lastNightRest: {
          round: NIGHT_TWO,
          quality: "comfortable",
        },
      },
    };

    const prepared = prepareRound(createAuthoringTestGame([tribute]), DAY_THREE);

    expect(prepared.events[0].preparation).toMatchObject({
      mechanic: "morning-rest-resolution",

      restQuality: "comfortable",

      affectedStatusIds: expect.arrayContaining(["exhausted", "well-rested"]),
    });

    const preparedStatuses = prepared.state.tributes[0].statuses;

    expect(preparedStatuses.some((status) => status.definitionId === "exhausted")).toBe(false);

    expect(preparedStatuses).toContainEqual(
      expect.objectContaining({
        definitionId: "well-rested",
        severity: 2,
      }),
    );
  });

  it("turns unsheltered sleep into exhaustion and removes stale well-rested", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "tired-tribute",
    });

    const wellRested = createStatusEffectInstance("old-rest", baseTribute.id, "well-rested", 1, {
      day: 2,
      period: "day",
    });

    const tribute: GameTribute = {
      ...baseTribute,

      statuses: [wellRested],

      survival: {
        ...baseTribute.survival,

        lastNightRest: {
          round: NIGHT_TWO,
          quality: "unsheltered",
        },
      },
    };

    const prepared = prepareRound(createAuthoringTestGame([tribute]), DAY_THREE);

    const preparedStatuses = prepared.state.tributes[0].statuses;

    expect(preparedStatuses.some((status) => status.definitionId === "well-rested")).toBe(false);

    expect(preparedStatuses).toContainEqual(
      expect.objectContaining({
        definitionId: "exhausted",
        severity: 1,
      }),
    );
  });

  it("produces identical checked rest results for equivalent games", () => {
    let tribute = createAuthoringTestTribute({
      id: "deterministic-sleeper",

      stats: {
        brains: 2,
        brawn: 3,
        luck: 3,
      },
    });

    tribute = withAuthoringTestItem(tribute, "matches");

    const first = prepareRound(createAuthoringTestGame([tribute]), NIGHT_TWO);

    const second = prepareRound(createAuthoringTestGame([tribute]), NIGHT_TWO);

    expect(first.events).toEqual(second.events);

    expect(first.state.tributes[0].survival.lastNightRest).toEqual(
      second.state.tributes[0].survival.lastNightRest,
    );
  });

  it("prefers a blanket over matches", () => {
    let tribute = createAuthoringTestTribute({
      id: "comfort-priority",
    });

    tribute = withAuthoringTestItem(tribute, "matches");

    tribute = withAuthoringTestItem(tribute, "blanket");

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      NIGHT_TWO,
    );

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]?.preparation).toMatchObject({
      mechanic: "night-rest-preparation",

      itemDefinitionId: "blanket",

      restQuality: "comfortable",

      usesRemainingAfter: null,
    });

    expect(
      prepared.state.tributes[0]?.inventory.some((item) => item.definitionId === "matches"),
    ).toBe(true);
  });

  it("prefers matches over harder-to-use kindling", () => {
    let tribute = createAuthoringTestTribute({
      id: "checked-rest-priority",
    });

    tribute = withAuthoringTestItem(tribute, "kindling");

    tribute = withAuthoringTestItem(tribute, "matches");

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      NIGHT_TWO,
    );

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]?.preparation).toMatchObject({
      mechanic: "night-rest-preparation",

      itemDefinitionId: "matches",
    });

    expect(
      prepared.state.tributes[0]?.inventory.some((item) => item.definitionId === "kindling"),
    ).toBe(true);
  });

  it("uses only one comfort item for a tribute", () => {
    let tribute = createAuthoringTestTribute({
      id: "single-comfort",
    });

    tribute = withAuthoringTestItem(tribute, "blanket");

    tribute = withAuthoringTestItem(tribute, "blanket");

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      NIGHT_TWO,
    );

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]?.changes.filter((change) => change.type === "use-item")).toHaveLength(
      1,
    );

    expect(prepared.committedItemInstanceIds.size).toBe(1);
  });

  it("records exactly one night-rest result for every living tribute", () => {
    const first: GameTribute = {
      ...createAuthoringTestTribute({
        id: "living-first",
      }),

      district: 1,
      districtPosition: 1,
    };

    const second: GameTribute = {
      ...createAuthoringTestTribute({
        id: "living-second",
      }),

      district: 1,
      districtPosition: 2,
    };

    const dead = createDeadTestTribute({
      ...createAuthoringTestTribute({
        id: "dead-sleeper",
      }),

      district: 2,
      districtPosition: 1,
    });

    const prepared = prepareRound(
      createAuthoringTestGame([first, second, dead]),

      NIGHT_TWO,
    );

    expect(prepared.events.map((event) => event.preparation?.actingTributeId)).toEqual([
      first.id,
      second.id,
    ]);

    expect(
      prepared.events.every((event) => event.preparation?.mechanic === "night-rest-preparation"),
    ).toBe(true);

    expect(
      prepared.events.flatMap((event) =>
        event.changes.filter((change) => change.type === "record-night-rest"),
      ),
    ).toHaveLength(2);
  });

  it("does not resolve morning rest for dead tributes", () => {
    const livingBase = createAuthoringTestTribute({
      id: "living-morning",
    });

    const living: GameTribute = {
      ...livingBase,

      district: 1,
      districtPosition: 1,

      survival: {
        ...livingBase.survival,

        lastNightRest: {
          round: NIGHT_TWO,
          quality: "unsheltered",
        },
      },
    };

    const deadBase = createAuthoringTestTribute({
      id: "dead-morning",
    });

    const dead = createDeadTestTribute({
      ...deadBase,

      district: 1,
      districtPosition: 2,

      survival: {
        ...deadBase.survival,

        lastNightRest: {
          round: NIGHT_TWO,
          quality: "unsheltered",
        },
      },
    });

    const prepared = prepareRound(
      createAuthoringTestGame([living, dead]),

      DAY_THREE,
    );

    expect(prepared.events.map((event) => event.preparation?.actingTributeId)).toEqual([living.id]);

    expect(prepared.state.tributes.find((tribute) => tribute.id === dead.id)?.statuses).toEqual([]);
  });
});
