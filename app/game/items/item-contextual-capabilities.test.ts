import { describe, expect, it } from "vitest";

import { getAwarenessScore, getCombatScore, getSurvivalScore } from "~/game/engine/stat-formulas";

import {
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getNightAmbushItemTargetWeightMultiplier,
  getNightAwarenessItemBonus,
} from "./item-contextual-capabilities";

const DAY = {
  day: 2,
  period: "day",
} as const;

const NIGHT = {
  day: 2,
  period: "night",
} as const;

describe("item contextual capabilities", () => {
  it("lets binoculars improve ordinary awareness", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "binocular-user",
    });

    const equippedTribute = withAuthoringTestItem(baseTribute, "binoculars");

    expect(
      getAwarenessScore(equippedTribute, DAY) - getAwarenessScore(baseTribute, DAY),
    ).toBeCloseTo(0.6);
  });

  it("does not let binoculars directly change combat or survival", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "binocular-specialization",
    });

    const equippedTribute = withAuthoringTestItem(baseTribute, "binoculars");

    expect(getCombatScore(equippedTribute)).toBe(getCombatScore(baseTribute));

    expect(getSurvivalScore(equippedTribute)).toBe(getSurvivalScore(baseTribute));
  });

  it("gives night-vision goggles no daytime awareness bonus", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "daytime-goggles",
      }),

      "night-vision-goggles",
    );

    expect(getNightAwarenessItemBonus(tribute, DAY)).toBe(0);
  });

  it("gives night-vision goggles awareness at night", () => {
    const baseTribute = createAuthoringTestTribute({
      id: "nighttime-goggles",
    });

    const equippedTribute = withAuthoringTestItem(baseTribute, "night-vision-goggles");

    expect(getNightAwarenessItemBonus(equippedTribute, NIGHT)).toBeCloseTo(0.75);

    expect(
      getAwarenessScore(equippedTribute, NIGHT) - getAwarenessScore(baseTribute, NIGHT),
    ).toBeCloseTo(0.75);
  });

  it("reduces night ambush target weight", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "ambush-aware",
      }),

      "night-vision-goggles",
    );

    expect(getNightAmbushItemTargetWeightMultiplier(tribute, NIGHT, true)).toBeCloseTo(0.55);
  });

  it("does not reduce daytime ambush target weight", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "day-ambush",
      }),

      "night-vision-goggles",
    );

    expect(getNightAmbushItemTargetWeightMultiplier(tribute, DAY, true)).toBe(1);
  });

  it("does not reduce non-ambush night targeting", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "ordinary-night-threat",
      }),

      "night-vision-goggles",
    );

    expect(getNightAmbushItemTargetWeightMultiplier(tribute, NIGHT, false)).toBe(1);
  });

  it("ignores unusable night-vision goggles", () => {
    const tribute = withAuthoringTestItem(
      createAuthoringTestTribute({
        id: "depleted-goggles",
      }),

      "night-vision-goggles",

      {
        usesRemaining: 0,
      },
    );

    expect(getNightAwarenessItemBonus(tribute, NIGHT)).toBe(0);

    expect(getNightAmbushItemTargetWeightMultiplier(tribute, NIGHT, true)).toBe(1);
  });
});
