import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { getCombatScore } from "~/game/engine/stat-formulas";
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

describe("status and inventory interactions", () => {
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
