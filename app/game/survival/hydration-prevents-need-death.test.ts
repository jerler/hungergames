import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute, ResolvedEvent } from "~/game/types/game-state";

import { advanceSurvivalNeedsAfterRound } from "./survival-needs-engine";

describe("hydration before fatal need resolution", () => {
  it("prevents a tribute at five deprived rounds from dying", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "thirsty-tribute",
    });

    const endangeredTribute: GameTribute = withAuthoringTestItem(
      {
        ...baseTribute,

        survival: {
          ...baseTribute.survival,

          roundsWithoutWater: 5,
        },

        statuses: [
          createStatusEffectInstance(
            "existing-dehydration",
            baseTribute.id,
            "dehydrated",
            1,
            AUTHORING_TEST_ROUND,
          ),
        ],
      },
      "water",
    );

    const otherTribute = createAuthoringTestTribute({
      id: "other-tribute",
    });

    const game = createAuthoringTestGame([endangeredTribute, otherTribute]);

    const item = endangeredTribute.inventory[0];

    if (!item) {
      throw new Error("Expected a water item.");
    }

    const hydrationEvent: ResolvedEvent = {
      id: "automatic-hydration",
      definitionId: "automatic-hydration",

      kind: "preparation",
      resolutionMode: "standard",

      round: {
        ...AUTHORING_TEST_ROUND,
      },

      participantTributeIds: [endangeredTribute.id],

      text: "The tribute drinks water.",

      changes: compileItemUseEffects({
        eventId: "automatic-hydration",

        round: AUTHORING_TEST_ROUND,

        actingTribute: endangeredTribute,

        owner: endangeredTribute,

        item,
      }),
    };

    const hydratedState = applyResolvedEvent(game, hydrationEvent);

    const completedState = advanceSurvivalNeedsAfterRound(hydratedState);

    const resolvedTribute = completedState.tributes.find(
      (tribute) => tribute.id === endangeredTribute.id,
    );

    expect(resolvedTribute?.isAlive).toBe(true);

    expect(resolvedTribute?.survival.roundsWithoutWater).toBe(1);

    expect(resolvedTribute?.statuses.map((status) => status.definitionId)).not.toContain("thirsty");

    expect(resolvedTribute?.statuses.map((status) => status.definitionId)).not.toContain(
      "dehydrated",
    );

    expect(resolvedTribute?.inventory).toHaveLength(0);

    expect(hydratedState.itemTransactions).toContainEqual(
      expect.objectContaining({
        type: "consumed",
        tributeId: endangeredTribute.id,

        itemInstanceId: item.id,
        uses: 1,
      }),
    );
  });
});
