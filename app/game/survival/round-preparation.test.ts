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
  statusId: "bleeding" | "injured" | "thirsty" | "dehydrated" | "hungry" | "starving",
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

describe("prepareRound", () => {
  it("visibly applies urgent medical treatment", () => {
    let tribute = createAuthoringTestTribute({
      id: "patient",
    });

    tribute = withStatus(tribute, "bleeding", 1);

    tribute = withStatus(tribute, "injured");

    tribute = withAuthoringTestItem(tribute, "medicine");

    const medicine = tribute.inventory[0];

    if (!medicine) {
      throw new Error("Expected a medicine fixture.");
    }

    const game = createAuthoringTestGame([tribute]);

    const prepared = prepareRound(game, ROUND);

    expect(prepared.events).toHaveLength(1);

    expect(prepared.events[0]).toMatchObject({
      kind: "preparation",

      preparation: {
        mechanic: "urgent-medical-treatment",

        actingTributeId: tribute.id,

        itemOwnerTributeId: tribute.id,

        itemInstanceId: medicine.id,

        usesRemainingAfter: 0,
      },
    });

    expect(prepared.state.tributes[0].statuses).toEqual([]);

    expect(prepared.state.tributes[0].inventory).toEqual([]);

    expect(prepared.state.eventHistory).toContainEqual(prepared.events[0]);

    expect(prepared.committedItemInstanceIds).toContain(medicine.id);
  });

  it("does not consume medicine for non-urgent treatment", () => {
    let tribute = createAuthoringTestTribute();

    tribute = withStatus(tribute, "bleeding", 2);

    tribute = withAuthoringTestItem(tribute, "medicine");

    const game = createAuthoringTestGame([tribute]);

    const prepared = prepareRound(game, ROUND);

    expect(prepared.events).toEqual([]);

    expect(prepared.state.tributes[0].inventory).toHaveLength(1);
  });

  it("resolves hydration before food", () => {
    let tribute: GameTribute = {
      ...createAuthoringTestTribute(),

      survival: {
        roundsWithoutFood: 3,
        roundsWithoutWater: 2,
        lastNightRest: null,
      },
    };

    tribute = withStatus(tribute, "dehydrated");

    tribute = withStatus(tribute, "hungry");

    tribute = withAuthoringTestItem(tribute, "water");

    tribute = withAuthoringTestItem(tribute, "food");

    const prepared = prepareRound(createAuthoringTestGame([tribute]), ROUND);

    expect(prepared.events.map((event) => event.preparation?.mechanic)).toEqual([
      "hydration-consumption",
      "food-consumption",
    ]);

    const preparedTribute = prepared.state.tributes[0];

    expect(preparedTribute.survival.roundsWithoutWater).toBe(0);

    expect(preparedTribute.survival.roundsWithoutFood).toBe(0);

    expect(preparedTribute.statuses.map((status) => status.definitionId)).toEqual(["well-fed"]);
  });

  it("attributes borrowed medicine to its physical owner", () => {
    let patient = createAuthoringTestTribute({
      id: "patient",
    });

    patient = {
      ...patient,
      district: 1,
      districtPosition: 1,
    };

    patient = withStatus(patient, "bleeding", 1);

    let owner = createAuthoringTestTribute({
      id: "owner",
    });

    owner = {
      ...owner,
      district: 1,
      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "medicine");

    const game: GameState = {
      ...createAuthoringTestGame([patient, owner]),

      truces: [
        createTruceInstance("preparation-truce", [patient.id, owner.id], ROUND, {
          day: 3,
          period: "day",
        }),
      ],
    };

    const prepared = prepareRound(game, ROUND);

    const event = prepared.events[0];

    expect(event.preparation).toMatchObject({
      actingTributeId: patient.id,
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

  it("records unsheltered rest when no equipment is available", () => {
    const tribute = createAuthoringTestTribute({
      id: "exposed-sleeper",
    });

    const prepared = prepareRound(createAuthoringTestGame([tribute]), NIGHT_TWO);

    expect(prepared.events[0]).toMatchObject({
      kind: "preparation",

      preparation: {
        mechanic: "night-rest-preparation",

        actingTributeId: tribute.id,
        restQuality: "unsheltered",
      },
    });

    expect(prepared.events[0].preparation?.itemInstanceId).toBeUndefined();

    expect(prepared.state.tributes[0].survival.lastNightRest).toEqual({
      round: NIGHT_TWO,
      quality: "unsheltered",
    });
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
        quality: "unsheltered",
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
});
