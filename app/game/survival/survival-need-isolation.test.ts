import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

import { prepareRound } from "./round-preparation";

const DAY_TWO = {
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

function createStatus(tribute: GameTribute, statusId: StatusEffect["definitionId"]): StatusEffect {
  return createStatusEffectInstance(`isolation-${statusId}`, tribute.id, statusId, 1, DAY_TWO);
}

describe("survival need isolation", () => {
  it("morning rest preserves hunger and thirst", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "resting-tribute",
    });

    const tribute: GameTribute = {
      ...baseTribute,
      survival: {
        ...baseTribute.survival,
        lastNightRest: {
          round: NIGHT_TWO,
          quality: "sheltered",
        },
      },
      statuses: [createStatus(baseTribute, "hungry"), createStatus(baseTribute, "thirsty")],
    };

    const prepared = prepareRound(createAuthoringTestGame([tribute]), DAY_THREE);

    const preparedTribute = prepared.state.tributes[0];

    expect(preparedTribute.statuses.map((status) => status.definitionId)).toEqual(
      expect.arrayContaining(["hungry", "thirsty", "well-rested"]),
    );

    expect(preparedTribute.survival).toEqual(tribute.survival);
  });

  it("medical treatment preserves hunger and thirst", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "medical-tribute",
    });

    let tribute: GameTribute = {
      ...baseTribute,
      statuses: [
        createStatus(baseTribute, "injured"),
        createStatus(baseTribute, "hungry"),
        createStatus(baseTribute, "thirsty"),
      ],
    };

    tribute = withAuthoringTestItem(tribute, "med-kit");

    const prepared = prepareRound(createAuthoringTestGame([tribute]), DAY_THREE);

    expect(prepared.state.tributes[0].statuses.map((status) => status.definitionId)).toEqual([
      "hungry",
      "thirsty",
    ]);
  });
});
