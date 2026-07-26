import { describe, expect, it } from "vitest";

import { createDefaultTributeSurvivalState } from "~/game/survival/survival-schema";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

import { getActiveStatuses, isActiveStatus } from "./status-selectors";

function createStatus(
  definitionId: StatusEffect["definitionId"],
  remainingRounds: number | null,
  severity: StatusEffect["severity"] = 1,
  id = `status-${definitionId}`,
): StatusEffect {
  return {
    id,
    definitionId,
    severity,
    remainingRounds,
    sourceEventId: `event-${definitionId}`,
    sourceTributeId: null,
    appliedRound: {
      day: 2,
      period: "day",
    },
  };
}

function createTribute(statuses: readonly StatusEffect[]): GameTribute {
  return {
    id: "tribute-1",
    sourceDefinitionId: null,
    district: 1,
    districtPosition: 1,
    snapshot: {
      name: "Avery Chen",
      pronouns: "she",
      portraitUrl: null,
      stats: {
        brains: 3,
        brawn: 3,
        luck: 3,
      },
    },
    isAlive: true,
    death: null,
    survival: createDefaultTributeSurvivalState(),
    statuses: [...statuses],
    inventory: [],
    allianceId: null,
    statistics: {
      kills: 0,
      attemptedKills: 0,
      giftsReceived: 0,
      eventsSurvived: 0,
    },
  };
}

describe("status selectors", () => {
  it("returns no statuses when none are active", () => {
    expect(getActiveStatuses(createTribute([]))).toEqual([]);
  });

  it("filters expired timed statuses while preserving persistent statuses", () => {
    const expired = createStatus("exhausted", 0);
    const persistent = createStatus("hungry", null);

    expect(isActiveStatus(expired)).toBe(false);
    expect(isActiveStatus(persistent)).toBe(true);

    expect(
      getActiveStatuses(createTribute([expired, persistent])).map((status) => status.definitionId),
    ).toEqual(["hungry"]);
  });

  it("deduplicates non-stackable definitions deterministically", () => {
    const olderWeakerStatus = createStatus("injured", 1, 1, "status-injured-older");

    const newerStrongerStatus: StatusEffect = {
      ...createStatus("injured", 3, 3, "status-injured-newer"),
      appliedRound: {
        day: 3,
        period: "night",
      },
    };

    expect(getActiveStatuses(createTribute([olderWeakerStatus, newerStrongerStatus]))).toEqual([
      newerStrongerStatus,
    ]);
  });

  it("orders fatal, harmful severity, persistent needs, and benefits", () => {
    const statuses = [
      createStatus("well-rested", 2, 3),
      createStatus("thirsty", null, 3),
      createStatus("disoriented", 2, 1),
      createStatus("hungry", null, 1),
      createStatus("exhausted", 2, 2),
      createStatus("injured", 3, 3),
      createStatus("poisoned", 2, 3),
      createStatus("bleeding", 1, 1),
      createStatus("alert", 1, 3),
    ];

    expect(getActiveStatuses(createTribute(statuses)).map((status) => status.definitionId)).toEqual(
      [
        "bleeding",
        "poisoned",
        "injured",
        "exhausted",
        "disoriented",
        "hungry",
        "thirsty",
        "alert",
        "well-rested",
      ],
    );
  });

  it("uses alphabetical ordering rather than insertion order for ties", () => {
    const statuses = [
      createStatus("thirsty", null),
      createStatus("hungry", null),
      createStatus("lucky", 2),
      createStatus("alert", 2),
    ];

    expect(getActiveStatuses(createTribute(statuses)).map((status) => status.definitionId)).toEqual(
      ["hungry", "thirsty", "alert", "lucky"],
    );
  });
});
