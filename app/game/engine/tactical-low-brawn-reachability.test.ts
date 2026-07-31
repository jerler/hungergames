import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { createSeededRandom } from "~/game/engine/random";
import { TACTICAL_EVENTS } from "~/game/events/catalogue/encounters/tactical-events";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";

const ROUND = {
  day: 2,
  period: "day",
} as const;

function requireBlowgunAttack(): EventDefinition {
  const definition = TACTICAL_EVENTS.find((candidate) => candidate.id === "blowgun-poison-attack");

  if (!definition) {
    throw new Error("Missing blowgun-poison-attack.");
  }

  return definition;
}

function createFixture() {
  const lowBrawnAttacker = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: "low-brawn-attacker",
      name: "Low Brawn",
      stats: {
        brains: 5,
        brawn: 1,
        luck: 5,
      },
    }),
    "blowgun",
  );
  const highBrawnAttacker = withAuthoringTestItem(
    createAuthoringTestTribute({
      id: "high-brawn-attacker",
      name: "High Brawn",
      stats: {
        brains: 5,
        brawn: 5,
        luck: 5,
      },
    }),
    "blowgun",
  );
  const victim = createAuthoringTestTribute({
    id: "victim",
    name: "Victim",
    stats: {
      brains: 3,
      brawn: 3,
      luck: 3,
    },
  });

  /*
   * combatRolePair selects the victim role before the killer role.
   * Keep the designated neutral victim first so a zero-valued first draw
   * fixes that role before the attacker weighting is evaluated.
   */
  const state = {
    ...createAuthoringTestGame([victim, lowBrawnAttacker, highBrawnAttacker]),
    seed: "tactical-low-brawn-reachability",
    currentRound: ROUND,
  };
  const context: EventSelectionContext = {
    state,
    round: ROUND,
    livingTributes: state.tributes,
  };

  return {
    context,
    victim,
    lowBrawnAttacker,
    highBrawnAttacker,
  };
}

describe("low-Brawn tactical offense reachability", () => {
  it("allows a Brawn-one tribute to execute a real tactical event", () => {
    const definition = requireBlowgunAttack();
    const { context, victim, lowBrawnAttacker } = createFixture();
    const selection = selectEventParticipants(
      definition,
      context,
      () => 0,
      new Set<string>(),
      new Set<string>(),
    );

    expect(selection).not.toBeNull();

    if (!selection) {
      throw new Error("Could not select the controlled tactical event.");
    }

    expect(selection.participantsByRole.victim?.[0]?.id).toBe(victim.id);
    expect(selection.participantsByRole.killer?.[0]?.id).toBe(lowBrawnAttacker.id);

    const resolution = definition.resolve({
      ...context,
      eventId: "controlled-low-brawn-tactical-event",
      random: () => 0,
      participantsByRole: selection.participantsByRole,
      itemsByRole: selection.itemsByRole,
      unavailableItemInstanceIds: new Set<string>(),
    });

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "increment-statistic",
        tributeId: lowBrawnAttacker.id,
        statistic: "attemptedKills",
      }),
    );
    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",
        tributeId: lowBrawnAttacker.id,
      }),
    );
  });

  it("moderately favours low Brawn when tactical aptitude is otherwise equal", () => {
    const definition = requireBlowgunAttack();
    const { context, victim, lowBrawnAttacker, highBrawnAttacker } = createFixture();
    const attackerRandom = createSeededRandom("tactical-low-brawn-attacker-distribution");
    const iterations = 20_000;
    let lowBrawnSelections = 0;
    let highBrawnSelections = 0;

    for (let index = 0; index < iterations; index += 1) {
      let roleSelectionCall = 0;
      const selection = selectEventParticipants(
        definition,
        context,
        () => {
          roleSelectionCall += 1;

          /*
           * The first draw selects the victim. Every later draw belongs to
           * attacker selection or backtracking and uses the measured stream.
           */
          return roleSelectionCall === 1 ? 0 : attackerRandom();
        },
        new Set<string>(),
        new Set<string>(),
      );

      const selectedVictimId = selection?.participantsByRole.victim?.[0]?.id;
      const attackerId = selection?.participantsByRole.killer?.[0]?.id;

      if (selectedVictimId !== victim.id) {
        throw new Error(`Controlled victim changed unexpectedly: ${String(selectedVictimId)}.`);
      }

      if (attackerId === lowBrawnAttacker.id) {
        lowBrawnSelections += 1;
      } else if (attackerId === highBrawnAttacker.id) {
        highBrawnSelections += 1;
      } else {
        throw new Error(`Unexpected controlled tactical attacker: ${String(attackerId)}.`);
      }
    }

    const lowBrawnRate = lowBrawnSelections / (lowBrawnSelections + highBrawnSelections);

    /*
     * Poison attacker weights are 5.3 for Brawn 1 and 5.0 for Brawn 5 when
     * Brains and Luck are equal, yielding an expected low-Brawn rate of
     * approximately 51.46%.
     */
    expect(lowBrawnSelections).toBeGreaterThan(highBrawnSelections);
    expect(lowBrawnRate).toBeGreaterThan(0.505);
    expect(lowBrawnRate).toBeLessThan(0.525);
  });
});
