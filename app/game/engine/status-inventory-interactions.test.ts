import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { getCombatScore, getForagingScore, getSurvivalScore } from "~/game/engine/stat-formulas";
import {
  createInventoryItemInstance,
  prepareTributesForRound,
} from "~/game/items/inventory-engine";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { advanceStatusDurations } from "~/game/statuses/status-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, ResolvedEvent } from "~/game/types/game-state";
import { createTruceInstance } from "~/game/truces/truce-engine";

function createGame(): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `id-${nextId}`;
      },
      seed: "status-item-test",
      now: "2026-07-18T12:00:00.000Z",
    },
  );
}

const AUTOMATIC_TREATMENT_CASES = [
  {
    itemId: "water",
    statusId: "dehydrated",
  },
  {
    itemId: "medicine",
    statusId: "bleeding",
  },
  {
    itemId: "medicine",
    statusId: "injured",
  },
  {
    itemId: "medicine",
    statusId: "sick",
  },
  {
    itemId: "medicine",
    statusId: "poisoned",
  },
  {
    itemId: "medicine",
    statusId: "burned",
  },
  {
    itemId: "blanket",
    statusId: "exposed",
  },
  {
    itemId: "matches",
    statusId: "exposed",
  },
  {
    itemId: "food",
    statusId: "exhausted",
  },
  {
    itemId: "map",
    statusId: "disoriented",
  },
  {
    itemId: "camouflage-net",
    statusId: "hunted",
  },
] as const;

describe("status and inventory interactions", () => {
  it.each([
    {
      itemId: "shield",
      score: getSurvivalScore,
    },
    {
      itemId: "axe",
      score: getCombatScore,
    },
    {
      itemId: "trap-kit",
      score: getForagingScore,
    },
    {
      itemId: "fishing-gear",
      score: getForagingScore,
    },
    {
      itemId: "slingshot",
      score: getCombatScore,
    },
  ] as const)("$itemId improves its intended score", ({ itemId, score }) => {
    const state = createGame();
    const tribute = state.tributes[0];

    const equippedTribute = {
      ...tribute,

      inventory: [
        createInventoryItemInstance(`test-${itemId}`, tribute.id, itemId, {
          day: 1,
          period: "day",
        }),
      ],
    };

    expect(score(equippedTribute)).toBeGreaterThan(score(tribute));
  });

  it("automatically consumes medicine to treat bleeding", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const round = {
      day: 1,
      period: "day" as const,
    };

    const event: ResolvedEvent = {
      id: "setup-event",
      definitionId: "test-setup",
      resolutionMode: "standard",
      round,
      participantTributeIds: [tribute.id],
      text: "Test setup.",
      changes: [
        {
          type: "apply-status",
          tributeId: tribute.id,

          status: createStatusEffectInstance("setup-event", tribute.id, "bleeding", 2, round),
        },
        {
          type: "acquire-item",
          tributeId: tribute.id,

          item: createInventoryItemInstance("setup-event", tribute.id, "medicine", round),
        },
      ],
    };

    const affectedState = applyResolvedEvent(state, event);

    const preparedState = prepareTributesForRound(affectedState, {
      day: 1,
      period: "night",
    });

    const preparedTribute = preparedState.tributes[0];

    expect(preparedTribute.statuses).toEqual([]);

    expect(preparedTribute.inventory).toEqual([]);

    expect(preparedState.itemTransactions.map((transaction) => transaction.type)).toEqual([
      "acquired",
      "consumed",
    ]);
  });

  it("kills tributes whose untreated status reaches zero", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const appliedRound = {
      day: 1,
      period: "day" as const,
    };

    const stateWithStatus = {
      ...state,
      currentRound: appliedRound,

      tributes: state.tributes.map((candidate) =>
        candidate.id === tribute.id
          ? {
              ...candidate,

              statuses: [
                createStatusEffectInstance(
                  "injury-event",
                  tribute.id,
                  "injured",
                  1,
                  appliedRound,
                  2,
                ),
              ],
            }
          : candidate,
      ),
    };

    // The status was applied during Day 1, so completing
    // Day 1 should not consume one of its active rounds.
    const afterApplicationRound = advanceStatusDurations(stateWithStatus);

    expect(afterApplicationRound.tributes[0].statuses[0].remainingRounds).toBe(2);

    // It affects Night 1, then loses one round of duration.
    const afterFirstActiveRound = advanceStatusDurations({
      ...afterApplicationRound,
      currentRound: {
        day: 1,
        period: "night",
      },
    });

    expect(afterFirstActiveRound.tributes[0].statuses[0].remainingRounds).toBe(1);

    // It affects Day 2, then expires.
    const afterSecondActiveRound = advanceStatusDurations({
      ...afterFirstActiveRound,
      currentRound: {
        day: 2,
        period: "day",
      },
    });

    const affectedTribute = afterSecondActiveRound.tributes.find(
      (candidate) => candidate.id === tribute.id,
    );

    expect(affectedTribute).toMatchObject({
      isAlive: false,
      statuses: [],
      death: {
        causeId: "status:injured",
        causeLabel: "Untreated injuries",
        summary: `${tribute.snapshot.name} ` + "succumbs to untreated injuries.",
        killerTributeIds: [],
      },
    });

    expect(afterSecondActiveRound.eventHistory.at(-1)?.definitionId).toBe(
      "status-fatality:injured",
    );
  });

  it("lets recovering statuses expire without killing the tribute", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const appliedRound = {
      day: 1,
      period: "day" as const,
    };

    const stateWithStatus = {
      ...state,
      currentRound: appliedRound,

      tributes: state.tributes.map((candidate) =>
        candidate.id === tribute.id
          ? {
              ...candidate,

              statuses: [
                createStatusEffectInstance(
                  "exhaustion-event",
                  tribute.id,
                  "exhausted",
                  2,
                  appliedRound,
                  1,
                ),
              ],
            }
          : candidate,
      ),
    };

    const afterApplicationRound = advanceStatusDurations(stateWithStatus);

    expect(afterApplicationRound.tributes[0].statuses[0].remainingRounds).toBe(1);

    const historyLength = afterApplicationRound.eventHistory.length;

    const afterRecovery = advanceStatusDurations({
      ...afterApplicationRound,

      currentRound: {
        day: 1,
        period: "night",
      },
    });

    expect(afterRecovery.tributes[0]).toMatchObject({
      isAlive: true,
      death: null,
      statuses: [],
    });

    expect(afterRecovery.eventHistory).toHaveLength(historyLength);
  });

  it("allows beneficial statuses to improve scores", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const baseCombatScore = getCombatScore(tribute);

    const baseSurvivalScore = getSurvivalScore(tribute);

    const inspiredTribute = {
      ...tribute,

      statuses: [
        createStatusEffectInstance("inspiration-event", tribute.id, "inspired", 2, {
          day: 1,
          period: "day",
        }),
      ],
    };

    expect(getCombatScore(inspiredTribute)).toBeGreaterThan(baseCombatScore);

    expect(getSurvivalScore(inspiredTribute)).toBeGreaterThan(baseSurvivalScore);
  });

  it("allows recovering harmful statuses to reduce scores", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const disorientedTribute = {
      ...tribute,

      statuses: [
        createStatusEffectInstance("confusion-event", tribute.id, "disoriented", 2, {
          day: 1,
          period: "day",
        }),
      ],
    };

    expect(getSurvivalScore(disorientedTribute)).toBeLessThan(getSurvivalScore(tribute));
  });

  it("weapons improve combat while injuries reduce it", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const baseScore = getCombatScore(tribute);

    const armedTribute = {
      ...tribute,

      inventory: [
        createInventoryItemInstance("weapon-event", tribute.id, "bow", {
          day: 1,
          period: "day",
        }),
      ],
    };

    const injuredTribute = {
      ...tribute,

      statuses: [
        createStatusEffectInstance("injury-event", tribute.id, "injured", 3, {
          day: 1,
          period: "day",
        }),
      ],
    };

    expect(getCombatScore(armedTribute)).toBeGreaterThan(baseScore);

    expect(getCombatScore(injuredTribute)).toBeLessThan(baseScore);
  });

  it("uses medicine on bleeding before a less urgent injury", () => {
    const state = createGame();
    const tribute = state.tributes[0];

    const round = {
      day: 1,
      period: "day" as const,
    };

    const setupEvent: ResolvedEvent = {
      id: "medicine-priority-setup",

      definitionId: "medicine-priority-test",

      resolutionMode: "standard",
      round,

      participantTributeIds: [tribute.id],

      text: "Treatment priority setup.",

      changes: [
        {
          type: "apply-status",
          tributeId: tribute.id,

          status: createStatusEffectInstance("bleeding-setup", tribute.id, "bleeding", 1, round),
        },
        {
          type: "apply-status",
          tributeId: tribute.id,

          status: createStatusEffectInstance("injury-setup", tribute.id, "injured", 1, round),
        },
        {
          type: "acquire-item",
          tributeId: tribute.id,

          item: createInventoryItemInstance("medicine-setup", tribute.id, "medicine", round),
        },
      ],
    };

    const affectedState = applyResolvedEvent(state, setupEvent);

    const preparedState = prepareTributesForRound(affectedState, {
      day: 1,
      period: "night",
    });

    const preparedTribute = preparedState.tributes[0];

    expect(preparedTribute.statuses.map((status) => status.definitionId)).toEqual(["injured"]);

    expect(preparedTribute.inventory).toEqual([]);
  });

  it("uses a truce partner's medicine for automatic treatment", () => {
    const originalState = createGame();

    const patient = originalState.tributes[0];

    const itemOwner = originalState.tributes[1];

    const round = {
      day: 1,
      period: "day" as const,
    };

    const bleeding = createStatusEffectInstance(
      "shared-treatment-status",
      patient.id,
      "bleeding",
      2,
      round,
    );

    const medicine = createInventoryItemInstance(
      "shared-treatment-item",
      itemOwner.id,
      "medicine",
      round,
    );

    const truce = createTruceInstance("shared-treatment-truce", [patient.id, itemOwner.id], round, {
      day: 1,
      period: "night",
    });

    const state: GameState = {
      ...originalState,

      tributes: originalState.tributes.map((tribute) => {
        if (tribute.id === patient.id) {
          return {
            ...tribute,
            statuses: [bleeding],
          };
        }

        if (tribute.id === itemOwner.id) {
          return {
            ...tribute,
            inventory: [medicine],
          };
        }

        return tribute;
      }),

      truces: [truce],
    };

    const preparedState = prepareTributesForRound(state, {
      day: 1,
      period: "night",
    });

    const preparedPatient = preparedState.tributes.find((tribute) => tribute.id === patient.id);

    const preparedOwner = preparedState.tributes.find((tribute) => tribute.id === itemOwner.id);

    expect(preparedPatient?.statuses).toEqual([]);

    expect(preparedOwner?.inventory).toEqual([]);

    expect(preparedState.itemTransactions).toContainEqual(
      expect.objectContaining({
        type: "consumed",

        /*
         * The transaction belongs to
         * the physical item owner.
         */
        tributeId: itemOwner.id,

        itemInstanceId: medicine.id,
        definitionId: "medicine",
        uses: 1,
      }),
    );
  });

  it.each(AUTOMATIC_TREATMENT_CASES)(
    "automatically uses $itemId to treat $statusId",
    ({ itemId, statusId }) => {
      const state = createGame();
      const tribute = state.tributes[0];

      const appliedRound = {
        day: 1,
        period: "day" as const,
      };

      const setupEvent: ResolvedEvent = {
        id: `setup-${itemId}-` + statusId,

        definitionId: "automatic-treatment-test",

        resolutionMode: "standard",
        round: appliedRound,

        participantTributeIds: [tribute.id],

        text: "Treatment setup.",

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(
              `status-${statusId}`,
              tribute.id,
              statusId,
              1,
              appliedRound,
            ),
          },
          {
            type: "acquire-item",
            tributeId: tribute.id,

            item: createInventoryItemInstance(`item-${itemId}`, tribute.id, itemId, appliedRound),
          },
        ],
      };

      const affectedState = applyResolvedEvent(state, setupEvent);

      const preparedState = prepareTributesForRound(affectedState, {
        day: 1,
        period: "night",
      });

      const preparedTribute = preparedState.tributes.find(
        (candidate) => candidate.id === tribute.id,
      );

      expect(preparedTribute).toBeDefined();

      expect(preparedTribute?.statuses).toEqual([]);

      const consumedTransaction = preparedState.itemTransactions.find(
        (transaction) => transaction.type === "consumed" && transaction.definitionId === itemId,
      );

      expect(consumedTransaction).toMatchObject({
        tributeId: tribute.id,
        definitionId: itemId,
        uses: 1,
        sourceId: `automatic-treatment:` + statusId,
      });
    },
  );
});
