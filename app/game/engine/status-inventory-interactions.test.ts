import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { getCombatScore, getForagingScore, getSurvivalScore } from "~/game/engine/stat-formulas";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import {
  createInventoryItemInstance,
  findAccessibleInventoryItem,
} from "~/game/items/inventory-engine";
import { createFatalChanges } from "~/game/events/event-change-builders";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { advanceStatusDurations } from "~/game/statuses/status-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameChange, GameState, ResolvedEvent } from "~/game/types/game-state";
import { createTruceInstance } from "~/game/truces/truce-engine";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

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

function createEvent(
  id: string,
  changes: GameChange[],
  participantTributeIds: string[],
): ResolvedEvent {
  return {
    id,
    definitionId: id,
    kind: "primary",
    resolutionMode: "standard",
    round: DAY_ONE,
    participantTributeIds,
    text: "Test event.",
    changes,
  };
}

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
                  "bleeding-event",
                  tribute.id,
                  "bleeding",
                  1,
                  appliedRound,
                  2,
                ),

                createStatusEffectInstance("hidden-event", tribute.id, "hidden", 3, appliedRound),
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
        causeId: "status:bleeding",
        causeLabel: "Bled out",
        summary: `${tribute.snapshot.name} ` + "bleeds out from an untreated wound.",
        killerTributeIds: [],
      },
    });

    expect(afterSecondActiveRound.eventHistory.at(-1)?.definitionId).toBe(
      "status-fatality:bleeding",
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
});

describe("death loot", () => {
  it("transfers the victim's complete inventory to their killer", () => {
    const game = createGame();

    const originalVictim = game.tributes[0];

    const originalKiller = game.tributes[1];

    const knife = createInventoryItemInstance(
      "death-loot-setup",
      originalVictim.id,
      "knife",
      DAY_ONE,
    );

    const medicine = createInventoryItemInstance(
      "death-loot-setup",
      originalVictim.id,
      "medicine",
      DAY_ONE,
    );

    const stateWithInventory = applyResolvedEvent(
      game,
      createEvent(
        "death-loot-setup",
        [
          {
            type: "acquire-item",

            tributeId: originalVictim.id,
            acquisitionSource: "cornucopia",
            item: knife,
          },
          {
            type: "acquire-item",

            tributeId: originalVictim.id,
            acquisitionSource: "cornucopia",
            item: medicine,
          },
        ],
        [originalVictim.id],
      ),
    );

    const victim = stateWithInventory.tributes.find((tribute) => tribute.id === originalVictim.id);

    const killer = stateWithInventory.tributes.find((tribute) => tribute.id === originalKiller.id);

    if (!victim || !killer) {
      throw new Error("Death-loot test tributes are missing.");
    }

    const text = `${killer.snapshot.name} kills ` + `${victim.snapshot.name}.`;

    const stateAfterDeath = applyResolvedEvent(
      stateWithInventory,
      createEvent(
        "death-loot-kill",
        createFatalChanges(victim, "death-loot-test", "Killed", text, killer),
        [victim.id, killer.id],
      ),
    );

    const deadVictim = stateAfterDeath.tributes.find((tribute) => tribute.id === victim.id);

    const survivingKiller = stateAfterDeath.tributes.find((tribute) => tribute.id === killer.id);

    expect(deadVictim?.isAlive).toBe(false);

    expect(deadVictim?.inventory).toEqual([]);

    expect(survivingKiller?.inventory).toEqual(expect.arrayContaining([knife, medicine]));

    /*
     * Reusable and limited-use items both
     * retain their original use values.
     */
    expect(survivingKiller?.inventory.find((item) => item.id === knife.id)?.usesRemaining).toBe(
      knife.usesRemaining,
    );

    expect(survivingKiller?.inventory.find((item) => item.id === medicine.id)?.usesRemaining).toBe(
      medicine.usesRemaining,
    );

    const lootTransactions = stateAfterDeath.itemTransactions.filter(
      (transaction) => transaction.type === "transferred" && transaction.sourceId === "death-loot",
    );

    expect(lootTransactions).toHaveLength(2);

    expect(lootTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromTributeId: victim.id,
          toTributeId: killer.id,

          itemInstanceId: knife.id,

          uses: knife.usesRemaining,
        }),
        expect.objectContaining({
          fromTributeId: victim.id,
          toTributeId: killer.id,

          itemInstanceId: medicine.id,

          uses: medicine.usesRemaining,
        }),
      ]),
    );

    expect(() => assertGameStateInvariants(stateAfterDeath)).not.toThrow();
  });

  it("makes looted items accessible to the killer's truce partners", () => {
    const game = createGame();

    const originalVictim = game.tributes[0];
    const originalKiller = game.tributes[1];
    const originalPartner = game.tributes[2];

    const knife = createInventoryItemInstance(
      "death-loot-access-item",
      originalVictim.id,
      "knife",
      DAY_ONE,
    );

    const stateWithInventory = applyResolvedEvent(
      game,
      createEvent(
        "death-loot-access-item",
        [
          {
            type: "acquire-item",

            tributeId: originalVictim.id,

            item: knife,
            acquisitionSource: "cornucopia",
          },
        ],
        [originalVictim.id],
      ),
    );

    const truce = createTruceInstance(
      "death-loot-access-truce",
      [originalKiller.id, originalPartner.id],
      DAY_ONE,
      {
        day: 1,
        period: "night",
      },
    );

    const stateWithTruce = applyResolvedEvent(
      stateWithInventory,
      createEvent(
        "death-loot-access-truce-event",
        [
          {
            type: "form-truce",
            truce,
          },
        ],
        truce.tributeIds,
      ),
    );

    const victim = stateWithTruce.tributes.find((tribute) => tribute.id === originalVictim.id);

    const killer = stateWithTruce.tributes.find((tribute) => tribute.id === originalKiller.id);

    if (!victim || !killer) {
      throw new Error("Death-loot access test tributes are missing.");
    }

    const text = `${killer.snapshot.name} kills ` + `${victim.snapshot.name}.`;

    const stateAfterDeath = applyResolvedEvent(
      stateWithTruce,
      createEvent(
        "death-loot-access-kill",
        createFatalChanges(victim, "death-loot-access-test", "Killed", text, killer),
        [victim.id, killer.id],
      ),
    );

    const killerAfterDeath = stateAfterDeath.tributes.find(
      (tribute) => tribute.id === originalKiller.id,
    );

    const partnerAfterDeath = stateAfterDeath.tributes.find(
      (tribute) => tribute.id === originalPartner.id,
    );

    if (!killerAfterDeath || !partnerAfterDeath) {
      throw new Error("Death-loot access test survivors are missing.");
    }

    const accessibleKnife = findAccessibleInventoryItem(stateAfterDeath, partnerAfterDeath, {
      definitionIds: ["knife"],
    });

    /*
     * The killer physically owns the item.
     */
    expect(killerAfterDeath.inventory).toContainEqual(knife);

    expect(partnerAfterDeath.inventory).not.toContainEqual(knife);

    /*
     * The killer's active truce partner can
     * nevertheless access the looted item.
     */
    expect(accessibleKnife).toMatchObject({
      owner: {
        id: killerAfterDeath.id,
      },

      item: {
        id: knife.id,
        definitionId: "knife",
        usesRemaining: knife.usesRemaining,
      },
    });

    expect(stateAfterDeath.truces).toContainEqual(truce);

    expect(() => assertGameStateInvariants(stateAfterDeath)).not.toThrow();
  });

  it("does not transfer inventory when no killer is credited", () => {
    const game = createGame();

    const originalVictim = game.tributes[0];

    const knife = createInventoryItemInstance(
      "uncredited-death-item",
      originalVictim.id,
      "knife",
      DAY_ONE,
    );

    const stateWithInventory = applyResolvedEvent(
      game,
      createEvent(
        "uncredited-death-item",
        [
          {
            type: "acquire-item",

            tributeId: originalVictim.id,
            acquisitionSource: "cornucopia",
            item: knife,
          },
        ],
        [originalVictim.id],
      ),
    );

    const victim = stateWithInventory.tributes.find((tribute) => tribute.id === originalVictim.id);

    if (!victim) {
      throw new Error("Uncredited-death test victim is missing.");
    }

    const text = `${victim.snapshot.name} is killed ` + "by an arena hazard.";

    const stateAfterDeath = applyResolvedEvent(
      stateWithInventory,
      createEvent(
        "uncredited-death",
        createFatalChanges(victim, "arena-hazard", "Arena hazard", text),
        [victim.id],
      ),
    );

    const deadVictim = stateAfterDeath.tributes.find((tribute) => tribute.id === victim.id);

    expect(deadVictim).toMatchObject({
      isAlive: false,

      death: {
        killerTributeIds: [],
      },

      inventory: [knife],
    });

    const deathLootTransactions = stateAfterDeath.itemTransactions.filter(
      (transaction) => transaction.type === "transferred" && transaction.sourceId === "death-loot",
    );

    expect(deathLootTransactions).toEqual([]);

    const anotherTributeReceivedKnife = stateAfterDeath.tributes
      .filter((tribute) => tribute.id !== victim.id)
      .some((tribute) => tribute.inventory.some((item) => item.id === knife.id));

    expect(anotherTributeReceivedKnife).toBe(false);

    expect(() => assertGameStateInvariants(stateAfterDeath)).not.toThrow();
  });
});
