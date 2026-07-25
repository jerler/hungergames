import { describe, expect, it } from "vitest";

import { createSeededRandom } from "~/game/engine/random";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import { createStatusEffectInstance } from "~/game/statuses/status-engine";

import { createTruceInstance } from "~/game/truces/truce-engine";

import type { GameState, GameTribute } from "~/game/types/game-state";

import {
  findCamouflagePreparationPlan,
  resolveCamouflagePreparationAttempt,
  type CamouflagePreparationPlan,
} from "./camouflage-preparation";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function requirePlan(
  state: GameState,
  tribute: GameTribute,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set(),
): CamouflagePreparationPlan {
  const plan = findCamouflagePreparationPlan(state, tribute, unavailableItemInstanceIds);

  if (!plan) {
    throw new Error(`Expected a camouflage plan for "${tribute.id}".`);
  }

  return plan;
}

function withHiddenStatus(tribute: GameTribute): GameTribute {
  return {
    ...tribute,

    statuses: [
      ...tribute.statuses,

      createStatusEffectInstance(
        "existing-camouflage",
        tribute.id,
        "hidden",
        1,
        AUTHORING_TEST_ROUND,
      ),
    ],
  };
}

describe("camouflage preparation", () => {
  it("prefers an owned net over owned paint", () => {
    let tribute = createAuthoringTestTribute({
      id: "prepared-tribute",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-paint");

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const state = createAuthoringTestGame([tribute]);

    const plan = requirePlan(state, tribute);

    expect(plan.itemId).toBe("camouflage-net");

    expect(plan.selection.owner.id).toBe(tribute.id);

    expect(plan.hiddenSeverity).toBe(2);
  });

  it("does not prepare an already-hidden tribute", () => {
    let tribute = createAuthoringTestTribute({
      id: "already-hidden",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    tribute = withHiddenStatus(tribute);

    const state = createAuthoringTestGame([tribute]);

    expect(findCamouflagePreparationPlan(state, tribute)).toBeNull();
  });

  it("applies the configured hidden severity on success", () => {
    let tribute = createAuthoringTestTribute({
      id: "successful-camouflage",

      stats: {
        brains: 5,
        brawn: 3,
        luck: 3,
      },
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const state = createAuthoringTestGame([tribute]);

    const plan = requirePlan(state, tribute);

    const attempt = resolveCamouflagePreparationAttempt({
      eventId: "successful-camouflage",

      round: ROUND,

      random: () => 0.6,

      tribute,
      plan,
    });

    expect(attempt.outcome).toBe("success");

    expect(attempt.affectedStatusIds).toEqual(["hidden"]);

    expect(attempt.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",

        tributeId: tribute.id,

        status: expect.objectContaining({
          definitionId: "hidden",

          severity: 2,
        }),
      }),
    );
  });

  it("uses either strong Brains or strong Luck", () => {
    let brainyTribute = createAuthoringTestTribute({
      id: "brainy-camouflage",

      stats: {
        brains: 5,
        brawn: 3,
        luck: 1,
      },
    });

    brainyTribute = withAuthoringTestItem(brainyTribute, "camouflage-net");

    const brainyState = createAuthoringTestGame([brainyTribute]);

    const brainyAttempt = resolveCamouflagePreparationAttempt({
      eventId: "brainy-camouflage",

      round: ROUND,

      random: () => 0.6,

      tribute: brainyTribute,

      plan: requirePlan(brainyState, brainyTribute),
    });

    let luckyTribute = createAuthoringTestTribute({
      id: "lucky-camouflage",

      stats: {
        brains: 1,
        brawn: 3,
        luck: 5,
      },
    });

    luckyTribute = withAuthoringTestItem(luckyTribute, "camouflage-net");

    const luckyState = createAuthoringTestGame([luckyTribute]);

    const luckyAttempt = resolveCamouflagePreparationAttempt({
      eventId: "lucky-camouflage",

      round: ROUND,

      random: () => 0.6,

      tribute: luckyTribute,

      plan: requirePlan(luckyState, luckyTribute),
    });

    expect(brainyAttempt.outcome).toBe("success");

    expect(luckyAttempt.outcome).toBe("success");
  });

  it("applies disoriented on critical failure", () => {
    let tribute = createAuthoringTestTribute({
      id: "failed-camouflage",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const state = createAuthoringTestGame([tribute]);

    const attempt = resolveCamouflagePreparationAttempt({
      eventId: "failed-camouflage",

      round: ROUND,

      random: () => 0,

      tribute,

      plan: requirePlan(state, tribute),
    });

    expect(attempt.outcome).toBe("critical-failure");

    expect(attempt.affectedStatusIds).toEqual(["disoriented"]);

    expect(attempt.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",

        tributeId: tribute.id,

        status: expect.objectContaining({
          definitionId: "disoriented",

          severity: 1,
        }),
      }),
    );

    expect(attempt.changes).not.toContainEqual(
      expect.objectContaining({
        type: "apply-status",

        status: expect.objectContaining({
          definitionId: "hidden",
        }),
      }),
    );
  });

  it("grants no status on ordinary failure", () => {
    let tribute = createAuthoringTestTribute({
      id: "ordinary-failure",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const state = createAuthoringTestGame([tribute]);

    const attempt = resolveCamouflagePreparationAttempt({
      eventId: "ordinary-failure",

      round: ROUND,

      random: () => 0.2,

      tribute,

      plan: requirePlan(state, tribute),
    });

    expect(attempt.outcome).toBe("failure");

    expect(attempt.affectedStatusIds).toEqual([]);

    expect(attempt.changes.some((change) => change.type === "apply-status")).toBe(false);
  });

  it("records reusable net use", () => {
    let tribute = createAuthoringTestTribute({
      id: "net-user",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const net = tribute.inventory[0];

    if (!net) {
      throw new Error("Expected a camouflage-net fixture.");
    }

    const state = createAuthoringTestGame([tribute]);

    const attempt = resolveCamouflagePreparationAttempt({
      eventId: "net-preparation",

      round: ROUND,

      random: () => 0.6,

      tribute,

      plan: requirePlan(state, tribute),
    });

    expect(attempt.changes).toContainEqual({
      type: "use-item",

      tributeId: tribute.id,

      itemInstanceId: net.id,

      reason: "net-preparation",
    });

    expect(attempt.changes.some((change) => change.type === "consume-item")).toBe(false);
  });

  it("consumes camouflage paint", () => {
    let tribute = createAuthoringTestTribute({
      id: "paint-user",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-paint");

    const paint = tribute.inventory[0];

    if (!paint) {
      throw new Error("Expected a camouflage-paint fixture.");
    }

    const state = createAuthoringTestGame([tribute]);

    const attempt = resolveCamouflagePreparationAttempt({
      eventId: "paint-preparation",

      round: ROUND,

      random: () => 0.6,

      tribute,

      plan: requirePlan(state, tribute),
    });

    expect(attempt.changes).toContainEqual({
      type: "consume-item",

      tributeId: tribute.id,

      itemInstanceId: paint.id,

      uses: 1,

      reason: "paint-preparation",
    });
  });

  it("attributes borrowed use to the physical owner", () => {
    const borrower: GameTribute = {
      ...createAuthoringTestTribute({
        id: "camouflage-borrower",
        name: "Katniss",
      }),

      district: 1,

      districtPosition: 1,
    };

    let owner: GameTribute = {
      ...createAuthoringTestTribute({
        id: "camouflage-owner",
        name: "Peeta",
      }),

      district: 1,

      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "camouflage-net");

    const net = owner.inventory[0];

    if (!net) {
      throw new Error("Expected a borrowed camouflage-net fixture.");
    }

    const state: GameState = {
      ...createAuthoringTestGame([borrower, owner]),

      truces: [
        createTruceInstance(
          "camouflage-truce",

          [borrower.id, owner.id],

          ROUND,

          {
            day: 3,
            period: "day",
          },
        ),
      ],
    };

    const plan = requirePlan(state, borrower);

    expect(plan.selection.owner.id).toBe(owner.id);

    expect(plan.selection.item.id).toBe(net.id);

    const attempt = resolveCamouflagePreparationAttempt({
      eventId: "borrowed-camouflage",

      round: ROUND,

      random: () => 0.6,

      tribute: borrower,

      plan,
    });

    expect(attempt.changes).toContainEqual({
      type: "use-item",

      tributeId: owner.id,

      itemInstanceId: net.id,

      reason: "borrowed-camouflage",
    });
  });

  it("ignores camouflage items reserved elsewhere", () => {
    let tribute = createAuthoringTestTribute({
      id: "reservation-test",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const net = tribute.inventory[0];

    if (!net) {
      throw new Error("Expected a camouflage-net fixture.");
    }

    const state = createAuthoringTestGame([tribute]);

    expect(findCamouflagePreparationPlan(state, tribute, new Set([net.id]))).toBeNull();
  });

  it("resolves equivalent seeded attempts identically", () => {
    let tribute = createAuthoringTestTribute({
      id: "deterministic-camouflage",

      stats: {
        brains: 4,
        brawn: 3,
        luck: 2,
      },
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const state = createAuthoringTestGame([tribute]);

    const plan = requirePlan(state, tribute);

    const resolve = () =>
      resolveCamouflagePreparationAttempt({
        eventId: "deterministic-camouflage",

        round: ROUND,

        random: createSeededRandom("camouflage-seed"),

        tribute,
        plan,
      });

    expect(resolve()).toEqual(resolve());
  });
});
