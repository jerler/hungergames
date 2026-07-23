import { describe, expect, it } from "vitest";

import { getCombatSelectionWeight, getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import { always, combatRolePair, createEvent, result } from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { areTributesInSameTruce } from "~/game/truces/truce-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";

function createCombatDefinition() {
  return createEvent("combat-role-test")
    .roles(...combatRolePair())
    .category("fatal")
    .tags("fatal", "combat")
    .during("day")
    .weight(1)
    .resolve(
      always(
        result({
          text: "Combat role test.",
        }),
      ),
    );
}

describe("combatRolePair", () => {
  it("creates opposed, weighted victim and killer roles", () => {
    const [victim, killer] = combatRolePair();

    expect(victim).toMatchObject({
      id: "victim",
      count: 1,
      opposesRoleIds: ["killer"],
    });

    expect(killer).toMatchObject({
      id: "killer",
      count: 1,
      opposesRoleIds: ["victim"],
    });

    expect(victim.getWeight).toBe(getVulnerabilityWeight);

    expect(killer.getWeight).toBe(getCombatSelectionWeight);
  });

  it("does not select active truce partners against each other", () => {
    const first = createAuthoringTestTribute({
      id: "first",
    });

    const second = createAuthoringTestTribute({
      id: "second",
    });

    const truce = createTruceInstance(
      "combat-role-truce",
      [first.id, second.id],
      AUTHORING_TEST_ROUND,
      {
        day: 2,
        period: "night",
      },
    );

    const state = {
      ...createAuthoringTestGame([first, second]),

      truces: [truce],
    };

    const selection = selectEventParticipants(
      createCombatDefinition(),
      {
        state,
        round: AUTHORING_TEST_ROUND,
        livingTributes: [first, second],
      },
      () => 0,
      new Set(),
      new Set(),
    );

    expect(selection).toBeNull();
  });

  it("selects a valid opposing pair when an outsider is available", () => {
    const first = createAuthoringTestTribute({
      id: "first",
    });

    const second = createAuthoringTestTribute({
      id: "second",
    });

    const outsider = createAuthoringTestTribute({
      id: "outsider",
    });

    const truce = createTruceInstance(
      "combat-role-truce",
      [first.id, second.id],
      AUTHORING_TEST_ROUND,
      {
        day: 2,
        period: "night",
      },
    );

    const state = {
      ...createAuthoringTestGame([first, second, outsider]),

      truces: [truce],
    };

    const selection = selectEventParticipants(
      createCombatDefinition(),
      {
        state,
        round: AUTHORING_TEST_ROUND,
        livingTributes: [first, second, outsider],
      },
      () => 0,
      new Set(),
      new Set(),
    );

    expect(selection).not.toBeNull();

    const victim = selection?.participantsByRole.victim?.[0];

    const killer = selection?.participantsByRole.killer?.[0];

    expect(victim).toBeDefined();
    expect(killer).toBeDefined();

    if (!victim || !killer) {
      throw new Error("Combat selection did not produce both roles.");
    }

    expect(areTributesInSameTruce(state, victim.id, killer.id)).toBe(false);
  });
});
