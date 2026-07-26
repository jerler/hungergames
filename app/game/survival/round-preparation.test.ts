import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameState, GameTribute } from "~/game/types/game-state";
import { createPreparationSeed, prepareRound } from "./round-preparation";

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
  statusId: "bleeding" | "injured" | "poisoned" | "burned" | "thirsty" | "hungry",
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
  it("applies specific medical treatment automatically", () => {
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

    expect(prepared.automaticEvents).toHaveLength(1);

    expect(prepared.automaticEvents[0]).toMatchObject({
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

    expect(prepared.automaticEvents).toHaveLength(1);

    expect(prepared.automaticEvents[0].preparation).toMatchObject({
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
        lastFoundFoodRound: null,
        lastFoundWaterRound: null,
        lastNightRest: null,
      },
    };

    tribute = withStatus(tribute, "thirsty");

    tribute = withStatus(tribute, "hungry");

    tribute = withAuthoringTestItem(tribute, "water");

    tribute = withAuthoringTestItem(tribute, "wild-fruit");

    const prepared = prepareRound(createAuthoringTestGame([tribute]), ROUND);

    expect(prepared.automaticEvents.map((event) => event.preparation?.mechanic)).toEqual([
      "hydration-consumption",
      "food-consumption",
    ]);

    const preparedTribute = prepared.state.tributes[0];

    expect(preparedTribute.survival.lastFoundWaterRound).toEqual(ROUND);

    expect(preparedTribute.survival.lastFoundFoodRound).toEqual(ROUND);

    expect(preparedTribute.statuses).toEqual([]);
  });

  it("waits until morning to consume food and water", () => {
    let tribute: GameTribute = {
      ...createAuthoringTestTribute({
        id: "overnight-supplies",
      }),

      survival: {
        lastFoundFoodRound: null,
        lastFoundWaterRound: null,
        lastNightRest: null,
      },
    };

    tribute = withStatus(tribute, "thirsty");
    tribute = withStatus(tribute, "hungry");
    tribute = withAuthoringTestItem(tribute, "water");
    tribute = withAuthoringTestItem(tribute, "wild-fruit");

    const prepared = prepareRound(createAuthoringTestGame([tribute]), NIGHT_TWO);

    const itemPreparationMechanics = prepared.automaticEvents.flatMap((event) => {
      const mechanic = event.preparation?.mechanic;

      return mechanic === "hydration-consumption" || mechanic === "food-consumption"
        ? [mechanic]
        : [];
    });

    expect(itemPreparationMechanics).toEqual([]);

    const preparedTribute = prepared.state.tributes[0];

    expect(preparedTribute?.survival).toMatchObject({
      lastFoundFoodRound: null,
      lastFoundWaterRound: null,
    });

    expect(preparedTribute?.statuses.map((status) => status.definitionId)).toEqual(
      expect.arrayContaining(["thirsty", "hungry"]),
    );

    expect(preparedTribute?.inventory.map((item) => item.definitionId)).toEqual(
      expect.arrayContaining(["water", "wild-fruit"]),
    );
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

    const event = prepared.automaticEvents[0];

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

    expect(prepared.automaticEvents).toHaveLength(1);

    expect(prepared.automaticEvents[0].preparation?.actingTributeId).toBe(first.id);
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
  it("does not assign rest or reserve comfort items when night begins", () => {
    let tribute = createAuthoringTestTribute({
      id: "event-driven-sleeper",
    });

    tribute = withAuthoringTestItem(tribute, "blanket");

    const blanket = tribute.inventory[0];

    if (!blanket) {
      throw new Error("Expected a blanket fixture.");
    }

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      NIGHT_TWO,
    );

    expect(
      prepared.automaticEvents.some(
        (event) => event.preparation?.mechanic === "night-rest-preparation",
      ),
    ).toBe(false);

    expect(prepared.state.tributes[0]?.survival.lastNightRest).toBeNull();

    expect(prepared.committedItemInstanceIds).not.toContain(blanket.id);

    expect(prepared.state.tributes[0]?.inventory).toContainEqual(blanket);
  });

  it("turns sheltered sleep into well-rested and removes exhaustion", () => {
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

    expect(prepared.automaticEvents[0]?.preparation).toMatchObject({
      mechanic: "morning-rest-resolution",

      restQuality: "sheltered",

      affectedStatusIds: expect.arrayContaining(["exhausted", "well-rested"]),
    });

    const preparedStatuses = prepared.state.tributes[0]?.statuses ?? [];

    expect(preparedStatuses.some((status) => status.definitionId === "exhausted")).toBe(false);

    expect(preparedStatuses).toContainEqual(
      expect.objectContaining({
        definitionId: "well-rested",
        severity: 1,
      }),
    );
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

    expect(prepared.automaticEvents[0].preparation).toMatchObject({
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

    expect(prepared.automaticEvents.map((event) => event.preparation?.actingTributeId)).toEqual([
      living.id,
    ]);

    expect(prepared.state.tributes.find((tribute) => tribute.id === dead.id)?.statuses).toEqual([]);
  });
});
