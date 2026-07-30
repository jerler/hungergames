import { describe, expect, it } from "vitest";

import type { RoundReference } from "~/game/types/game-state";

import { getLethalCandidateWeightMultiplier, getRoundLethalityProfile } from "./round-lethality";

function profile(day: number, period: RoundReference["period"], livingTributeCount = 24) {
  return getRoundLethalityProfile(
    {
      day,
      period,
    },
    livingTributeCount,
  );
}

describe("ordinary-round lethality curve", () => {
  it("keeps the first post-Bloodbath rounds quiet", () => {
    expect(profile(1, "night")).toMatchObject({
      preferredEliminations: 0,
      maxEliminations: 1,
    });

    expect(profile(2, "day")).toMatchObject({
      preferredEliminations: 1,
      maxEliminations: 2,
    });

    expect(profile(2, "night")).toMatchObject({
      preferredEliminations: 0,
      maxEliminations: 1,
    });
  });

  it("ramps both day and night limits upward while keeping days more lethal", () => {
    for (let day = 2; day <= 6; day += 1) {
      const dayProfile = profile(day, "day");
      const nightProfile = profile(day, "night");

      expect(dayProfile.maxEliminations).toBeGreaterThan(nightProfile.maxEliminations);
      expect(dayProfile.preferredEliminations).toBeGreaterThan(nightProfile.preferredEliminations);
      expect(dayProfile.lethalEventWeightMultiplier).toBeGreaterThan(
        nightProfile.lethalEventWeightMultiplier,
      );
    }
  });

  it("increases lethality from one day to the next", () => {
    for (let day = 3; day <= 6; day += 1) {
      const previousDay = profile(day - 1, "day");
      const currentDay = profile(day, "day");

      expect(currentDay.maxEliminations).toBeGreaterThanOrEqual(previousDay.maxEliminations);
      expect(currentDay.lethalEventWeightMultiplier).toBeGreaterThan(
        previousDay.lethalEventWeightMultiplier,
      );
    }
  });

  it("strongly prioritizes lethal candidates until the preferred count is reached", () => {
    const dayThree = profile(3, "day");

    expect(getLethalCandidateWeightMultiplier(dayThree, 0)).toBeGreaterThan(
      getLethalCandidateWeightMultiplier(dayThree, dayThree.preferredEliminations),
    );
  });

  it("never plans enough deaths to remove the final survivor", () => {
    expect(profile(6, "day", 3).maxEliminations).toBe(2);
    expect(profile(6, "night", 1).maxEliminations).toBe(0);
  });
});
