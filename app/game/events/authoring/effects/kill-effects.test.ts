import { describe, expect, it } from "vitest";

import { always, combatRolePair, createEvent, kill, result } from "~/game/events/authoring";
import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import { resolveAuthoredEvent } from "~/game/events/authoring/testing/resolve-authored-event";
import { attackerRole, victimRole } from "~/game/events/authoring";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";

describe("kill", () => {
  it("preserves killer credit and transfers death loot exactly once", () => {
    const killer = createAuthoringTestTribute({
      id: "killer",
      name: "Killer",
    });

    const victimBase = createAuthoringTestTribute({
      id: "victim",
      name: "Victim",
    });

    const food = createInventoryItemInstance(
      "victim-loot",
      victimBase.id,
      "food",
      AUTHORING_TEST_ROUND,
    );

    const shield = createInventoryItemInstance(
      "victim-loot",
      victimBase.id,
      "shield",
      AUTHORING_TEST_ROUND,
    );

    const victim = {
      ...victimBase,
      inventory: [food, shield],
    };

    const game = createAuthoringTestGame([killer, victim]);

    const definition = createEvent("authored-knife-kill")
      .roles(...combatRolePair())
      .category("fatal")
      .tags("fatal", "combat", "weapon")
      .during("day")
      .weight(1)
      .resolve(
        always(
          result({
            text: ({ killer, victim }) => `${killer.name} kills ${victim.name}.`,

            effects: [
              kill("killer", "victim", {
                causeId: "authored-knife-kill",
                causeLabel: "Knifed",
              }),
            ],
          }),
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      game,
      {
        killer: [killer],
        victim: [victim],
      },
      [0],
    );

    expect(resolution).toEqual({
      text: "Killer kills Victim.",

      changes: [
        {
          type: "eliminate-tribute",
          tributeId: victim.id,
          causeId: "authored-knife-kill",
          causeLabel: "Knifed",
          summary: "Killer kills Victim.",
          killerTributeIds: [killer.id],
        },
        {
          type: "increment-statistic",
          tributeId: killer.id,
          statistic: "attemptedKills",
          amount: 1,
        },
        {
          type: "increment-statistic",
          tributeId: killer.id,
          statistic: "kills",
          amount: 1,
        },
        {
          type: "transfer-item",
          itemInstanceId: food.id,
          fromTributeId: victim.id,
          toTributeId: killer.id,
          reason: "death-loot",
        },
        {
          type: "transfer-item",
          itemInstanceId: shield.id,
          fromTributeId: victim.id,
          toTributeId: killer.id,
          reason: "death-loot",
        },
      ],
    });
  });

  it("supports multiple fatalities in one outcome", () => {
    const killer = createAuthoringTestTribute({
      id: "killer",
    });

    const firstVictim = createAuthoringTestTribute({
      id: "first-victim",
    });

    const secondVictim = createAuthoringTestTribute({
      id: "second-victim",
    });

    const game = createAuthoringTestGame([killer, firstVictim, secondVictim]);

    const definition = createEvent("multi-kill-test")
      .roles(
        victimRole("first", {
          opposesRoleIds: ["killer"],
        }),

        victimRole("second", {
          opposesRoleIds: ["killer"],
        }),

        attackerRole("killer", {
          opposesRoleIds: ["first", "second"],
        }),
      )
      .category("fatal")
      .tags("fatal", "combat")
      .during("day")
      .weight(1)
      .resolve(
        always(
          result({
            text: "The killer eliminates both victims.",

            effects: [
              kill("killer", "first", {
                causeId: "multi-kill-test",
                causeLabel: "Killed",
              }),

              kill("killer", "second", {
                causeId: "multi-kill-test",
                causeLabel: "Killed",
              }),
            ],
          }),
        ),
      );

    const resolution = resolveAuthoredEvent(
      definition,
      game,
      {
        killer: [killer],
        first: [firstVictim],
        second: [secondVictim],
      },
      [0],
    );

    expect(resolution.changes.filter((change) => change.type === "eliminate-tribute")).toHaveLength(
      2,
    );

    expect(
      resolution.changes.filter(
        (change) => change.type === "increment-statistic" && change.statistic === "attemptedKills",
      ),
    ).toHaveLength(2);

    expect(
      resolution.changes.filter(
        (change) => change.type === "increment-statistic" && change.statistic === "kills",
      ),
    ).toHaveLength(2);
  });

  it("rejects the same role as killer and victim", () => {
    expect(() =>
      createEvent("self-kill-test")
        .solo("tribute")
        .category("fatal")
        .tags("fatal")
        .during("day")
        .weight(1)
        .resolve(
          always(
            result({
              text: "Invalid.",

              effects: [
                kill("tribute", "tribute", {
                  causeId: "self-kill-test",
                  causeLabel: "Killed",
                }),
              ],
            }),
          ),
        ),
    ).toThrow("cannot use the same role as killer and victim");
  });
});
