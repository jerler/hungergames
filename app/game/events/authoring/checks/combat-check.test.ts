import { describe, expect, it } from "vitest";

import { ordinaryAttackCheck } from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";

function createContext(random: () => number) {
  const killer = createAuthoringTestTribute({
    id: "killer",
  });

  const victim = createAuthoringTestTribute({
    id: "victim",
  });

  const item = createInventoryItemInstance(
    "combat-check-weapon",
    killer.id,
    "knife",
    AUTHORING_TEST_ROUND,
  );

  const equippedKiller = {
    ...killer,
    inventory: [item],
  };

  return {
    state: createAuthoringTestGame([equippedKiller, victim]),

    round: AUTHORING_TEST_ROUND,
    random,

    killer: equippedKiller,
    victim,

    weapon: {
      userTributeId: equippedKiller.id,
      owner: equippedKiller,
      item,
    },
  };
}

describe("ordinaryAttackCheck", () => {
  it("can deterministically resolve success and failure", () => {
    const check = ordinaryAttackCheck();

    expect(check(createContext(() => 0))).toBe("success");

    expect(check(createContext(() => 0.999))).toBe("failure");
  });

  it("supports an attacker advantage hook", () => {
    const check = ordinaryAttackCheck({
      attackerAdvantage: () => 100,
    });

    expect(check(createContext(() => 0.9))).toBe("success");
  });

  it("supports a victim defense hook", () => {
    const check = ordinaryAttackCheck({
      victimDefense: () => 100,
    });

    expect(check(createContext(() => 0.1))).toBe("failure");
  });
});
