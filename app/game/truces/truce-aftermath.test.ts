import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameChange, GameState, ResolvedEvent, TruceKind } from "~/game/types/game-state";
import { gameReducer } from "~/state/game-reducer";
import { ROMANTIC_VENDETTA_CHANCE, STANDARD_VENDETTA_CHANCE } from "~/game/truces/vendetta-engine";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

function createGame(): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount: 6 as const,
  };

  let nextId = 0;

  return createInitialGameState(
    config,

    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `id-${nextId}`;
      },

      seed: "truce-aftermath-tests",

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function createEvent(
  id: string,
  changes: GameChange[],
  participantTributeIds: string[],
): ResolvedEvent {
  return {
    id,
    definitionId: id,
    kind: "primary",
    resolutionMode: "standard",
    round: DAY_ONE,
    participantTributeIds,
    text: "Test event.",
    changes,
  };
}

function createDeathChange(
  tributeId: string,
  killerTributeIds: readonly string[] = [],
): GameChange {
  return {
    type: "eliminate-tribute",

    tributeId,

    causeId: "test-death",
    causeLabel: "Test death",
    summary: "A tribute died.",

    killerTributeIds: [...killerTributeIds],
  };
}

function formTestTruce(
  game: GameState,
  memberIds: readonly string[],
  kind: TruceKind = "standard",
): GameState {
  const truce = createTruceInstance(
    "test-truce",
    memberIds,
    DAY_ONE,
    kind === "romantic" ? null : NIGHT_ONE,
    kind,
  );

  return applyResolvedEvent(
    game,

    createEvent(
      "test-truce",
      [
        {
          type: "form-truce",
          truce,
        },
      ],
      [...memberIds],
    ),
  );
}

describe("accidental truce dissolution", () => {
  it("breaks the entire truce when one member dies", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 4);

    const formedState = formTestTruce(
      game,
      members.map((member) => member.id),
    );

    const stateAfterDeath = applyResolvedEvent(
      formedState,

      createEvent("member-death", [createDeathChange(members[0].id)], [members[0].id]),
    );

    expect(stateAfterDeath.truces).toEqual([]);

    const aftermathEvents = stateAfterDeath.eventHistory.filter(
      (event) => event.definitionId === "truce-ended-by-death",
    );

    expect(aftermathEvents).toHaveLength(1);

    expect(aftermathEvents[0]).toMatchObject({
      kind: "aftermath",
      participantTributeIds: members.map((member) => member.id),

      changes: [
        {
          type: "break-truce",

          reason: "accidental",
        },
      ],
    });

    /*
     * No smaller three-member truce
     * survives the death.
     */
    expect(stateAfterDeath.truces).toHaveLength(0);

    expect(() => assertGameStateInvariants(stateAfterDeath)).not.toThrow();
  });

  it("leaves survivor inventory untouched", () => {
    const game = createGame();

    const firstMember = game.tributes[0];

    const secondMember = game.tributes[1];

    const item = createInventoryItemInstance(
      "inventory-setup",
      secondMember.id,
      "medicine",
      DAY_ONE,
    );

    const gameWithItem = applyResolvedEvent(
      game,

      createEvent(
        "inventory-setup",
        [
          {
            type: "acquire-item",

            tributeId: secondMember.id,
            acquisitionSource: "cornucopia",
            item,
          },
        ],
        [secondMember.id],
      ),
    );

    const formedState = formTestTruce(gameWithItem, [firstMember.id, secondMember.id]);

    const transactionCountBefore = formedState.itemTransactions.length;

    const stateAfterDeath = applyResolvedEvent(
      formedState,

      createEvent("member-death", [createDeathChange(firstMember.id)], [firstMember.id]),
    );

    const survivingMember = stateAfterDeath.tributes.find(
      (tribute) => tribute.id === secondMember.id,
    );

    expect(survivingMember?.inventory).toContainEqual(item);

    expect(stateAfterDeath.itemTransactions).toHaveLength(transactionCountBefore);

    expect(
      stateAfterDeath.itemTransactions.some((transaction) => transaction.type === "transferred"),
    ).toBe(false);
  });

  it("creates only one aftermath when multiple members die together", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 3);

    const formedState = formTestTruce(
      game,
      members.map((member) => member.id),
    );

    const stateAfterDeaths = applyResolvedEvent(
      formedState,

      createEvent(
        "multiple-deaths",
        [createDeathChange(members[0].id), createDeathChange(members[1].id)],
        [members[0].id, members[1].id],
      ),
    );

    expect(
      stateAfterDeaths.eventHistory.filter(
        (event) => event.definitionId === "truce-ended-by-death",
      ),
    ).toHaveLength(1);

    expect(stateAfterDeaths.truces).toEqual([]);
  });

  it("does not affect a truce when an outsider dies", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 2);

    const outsider = game.tributes[2];

    const formedState = formTestTruce(
      game,
      members.map((member) => member.id),
    );

    const stateAfterDeath = applyResolvedEvent(
      formedState,

      createEvent("outsider-death", [createDeathChange(outsider.id)], [outsider.id]),
    );

    expect(stateAfterDeath.truces).toHaveLength(1);

    expect(
      stateAfterDeath.eventHistory.some((event) => event.definitionId === "truce-ended-by-death"),
    ).toBe(false);
  });

  it("inserts and immediately reveals the aftermath in the round feed", () => {
    const game = createGame();

    const members = game.tributes.slice(0, 2);

    const formedState = formTestTruce(
      game,
      members.map((member) => member.id),
    );

    const deathEvent = createEvent(
      "sequenced-death",
      [createDeathChange(members[0].id)],
      [members[0].id],
    );

    const roundState: GameState = {
      ...formedState,

      phase: "round-events",

      currentRound: DAY_ONE,

      roundEvents: [deathEvent],

      revealedEventCount: 0,
    };

    const nextState = gameReducer(
      roundState,

      {
        type: "event/revealed",

        now: "2026-07-20T12:01:00.000Z",
      },
    );

    if (!nextState) {
      throw new Error("Game unexpectedly reset.");
    }

    expect(nextState.roundEvents.map((event) => event.definitionId)).toEqual([
      "sequenced-death",
      "truce-ended-by-death",
    ]);

    expect(nextState.revealedEventCount).toBe(2);

    expect(nextState.eventHistory.map((event) => event.definitionId)).toContain(
      "truce-ended-by-death",
    );

    expect(nextState.truces).toEqual([]);
  });

  it("gives a romantic survivor either a vendetta or disorientation", () => {
    expect(ROMANTIC_VENDETTA_CHANCE).toBe(0.75);

    let vendettaCount = 0;
    let disorientedCount = 0;

    const attemptCount = 100;

    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      const game = createGame();

      const victim = game.tributes[0];
      const survivor = game.tributes[1];
      const killer = game.tributes[2];

      const formedState = formTestTruce(game, [victim.id, survivor.id], "romantic");

      const stateAfterDeath = applyResolvedEvent(
        formedState,

        createEvent(
          `romantic-partner-killed-${attempt}`,
          [createDeathChange(victim.id, [killer.id])],
          [victim.id, killer.id],
        ),
      );

      const survivorAfterDeath = stateAfterDeath.tributes.find(
        (tribute) => tribute.id === survivor.id,
      );

      const killerAfterDeath = stateAfterDeath.tributes.find((tribute) => tribute.id === killer.id);

      const vendetta = stateAfterDeath.vendettas.find(
        (candidate) =>
          candidate.hunterTributeId === survivor.id && candidate.targetTributeId === killer.id,
      );

      const disorientedStatus = survivorAfterDeath?.statuses.find(
        (status) => status.definitionId === "disoriented",
      );

      /*
       * The two grief responses are
       * mutually exclusive.
       */
      expect(Boolean(vendetta)).not.toBe(Boolean(disorientedStatus));

      if (vendetta) {
        vendettaCount += 1;

        expect(vendetta).toMatchObject({
          hunterTributeId: survivor.id,
          targetTributeId: killer.id,
          kind: "romantic",
        });
      }

      if (disorientedStatus) {
        disorientedCount += 1;

        expect(disorientedStatus.severity).toBe(2);
      }

      /*
       * Revenge no longer uses the generic
       * Hunted status.
       */
      expect(killerAfterDeath?.statuses.some((status) => status.definitionId === "hunted")).toBe(
        false,
      );
    }

    expect(vendettaCount + disorientedCount).toBe(attemptCount);

    /*
     * Confirm that the deterministic set of
     * event IDs exercises both possible paths.
     */
    expect(vendettaCount).toBeGreaterThan(0);
    expect(disorientedCount).toBeGreaterThan(0);
  });
  it("disorients a romantic survivor when there is no living killer", () => {
    const game = createGame();

    const victim = game.tributes[0];
    const survivor = game.tributes[1];

    const formedState = formTestTruce(game, [victim.id, survivor.id], "romantic");

    const stateAfterDeath = applyResolvedEvent(
      formedState,

      createEvent("romantic-environmental-death", [createDeathChange(victim.id)], [victim.id]),
    );

    const survivorAfterDeath = stateAfterDeath.tributes.find(
      (tribute) => tribute.id === survivor.id,
    );

    expect(stateAfterDeath.vendettas).toEqual([]);

    expect(survivorAfterDeath?.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "disoriented",
        severity: 2,
      }),
    );
  });
  it("sometimes gives a standard truce survivor a vendetta", () => {
    expect(STANDARD_VENDETTA_CHANCE).toBe(0.5);

    let vendettaCount = 0;
    const attemptCount = 40;

    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      const game = createGame();

      const victim = game.tributes[0];
      const survivor = game.tributes[1];
      const killer = game.tributes[2];

      const formedState = formTestTruce(game, [victim.id, survivor.id]);

      const stateAfterDeath = applyResolvedEvent(
        formedState,

        createEvent(
          `standard-partner-killed-${attempt}`,
          [createDeathChange(victim.id, [killer.id])],
          [victim.id, killer.id],
        ),
      );

      const vendetta = stateAfterDeath.vendettas.find(
        (candidate) =>
          candidate.hunterTributeId === survivor.id && candidate.targetTributeId === killer.id,
      );

      if (vendetta) {
        vendettaCount += 1;

        expect(vendetta.kind).toBe("standard");
      }

      const survivorAfterDeath = stateAfterDeath.tributes.find(
        (tribute) => tribute.id === survivor.id,
      );

      const killerAfterDeath = stateAfterDeath.tributes.find((tribute) => tribute.id === killer.id);

      /*
       * A failed standard vendetta roll
       * causes no emotional status.
       */
      expect(survivorAfterDeath?.statuses).toEqual([]);

      expect(killerAfterDeath?.statuses.some((status) => status.definitionId === "hunted")).toBe(
        false,
      );
    }

    expect(vendettaCount).toBeGreaterThan(0);

    expect(vendettaCount).toBeLessThan(attemptCount);
  });
  it("does nothing emotional for a standard truce when there is no killer", () => {
    const game = createGame();

    const victim = game.tributes[0];
    const survivor = game.tributes[1];

    const formedState = formTestTruce(game, [victim.id, survivor.id]);

    const stateAfterDeath = applyResolvedEvent(
      formedState,

      createEvent("standard-environmental-death", [createDeathChange(victim.id)], [victim.id]),
    );

    const survivorAfterDeath = stateAfterDeath.tributes.find(
      (tribute) => tribute.id === survivor.id,
    );

    expect(stateAfterDeath.vendettas).toEqual([]);

    expect(survivorAfterDeath?.statuses).toEqual([]);
  });
});
