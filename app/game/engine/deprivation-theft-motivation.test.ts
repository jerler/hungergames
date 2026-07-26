import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";

import { getDeprivationTheftMultiplier, getTheftItemStrategicValue } from "./theft-formulas";

const ROUND = {
  day: 3,
  period: "day",
} as const;

function withStatuses(statusIds: readonly ("hungry" | "thirsty")[]) {
  const tribute = createAuthoringTestTribute({
    id: statusIds.join("-") || "ordinary",
  });

  return {
    ...tribute,
    statuses: statusIds.map((statusId) =>
      createStatusEffectInstance(`status-${statusId}`, tribute.id, statusId, 1, ROUND),
    ),
  };
}

describe("deprivation theft motivation", () => {
  it("applies moderate capped multipliers", () => {
    expect(getDeprivationTheftMultiplier(withStatuses([]))).toBe(1);
    expect(getDeprivationTheftMultiplier(withStatuses(["hungry"]))).toBeCloseTo(1.3);
    expect(getDeprivationTheftMultiplier(withStatuses(["thirsty"]))).toBeCloseTo(1.4);
    expect(getDeprivationTheftMultiplier(withStatuses(["hungry", "thirsty"]))).toBeCloseTo(1.8);
  });

  it("makes matching deprivation protection more valuable", () => {
    const ordinary = withStatuses([]);
    const hungry = withStatuses(["hungry"]);
    const thirsty = withStatuses(["thirsty"]);
    const both = withStatuses(["hungry", "thirsty"]);
    const item = createInventoryItemInstance(
      "provision-value",
      ordinary.id,
      "cornucopia-provisions",
      ROUND,
    );

    const ordinaryValue = getTheftItemStrategicValue(item, ordinary);

    expect(getTheftItemStrategicValue(item, hungry)).toBeGreaterThan(ordinaryValue);
    expect(getTheftItemStrategicValue(item, thirsty)).toBeGreaterThan(ordinaryValue);
    expect(getTheftItemStrategicValue(item, both)).toBeGreaterThan(
      getTheftItemStrategicValue(item, thirsty),
    );
  });
});
