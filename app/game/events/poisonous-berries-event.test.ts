import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { createSeededRandom } from "~/game/engine/random";
import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { createTruceInstance } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState } from "~/game/types/game-state";
import { gameReducer } from "~/state/game-reducer";

import {
  isPoisonousBerriesFinaleEligible,
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT,
} from "./poisonous-berries-event";

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

    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, createSeededRandom("poisonous-berries-reaping")),

    "random",

    {
      createId: () => {
        nextId += 1;

        return `id-${nextId}`;
      },

      seed: "poisonous-berries-tests",

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function createFinalPairState(kind: "standard" | "romantic", livingTributeCount = 2): GameState {
  let state = createGame();

  const survivingTributeIds = new Set(
    state.tributes.slice(0, livingTributeCount).map((tribute) => tribute.id),
  );

  for (const [index, tribute] of state.tributes.entries()) {
    if (survivingTributeIds.has(tribute.id)) {
      continue;
    }

    const eventId = `setup-elimination-${index}`;

    const summary = `${tribute.snapshot.name} was eliminated during test setup.`;

    state = applyResolvedEvent(state, {
      id: eventId,

      definitionId: "test-elimination",

      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: [tribute.id],

      text: summary,

      changes: [
        {
          type: "eliminate-tribute",

          tributeId: tribute.id,

          causeId: "test-elimination",

          causeLabel: "Test elimination",

          summary,

          killerTributeIds: [],
        },
      ],
    });
  }

  const firstPartner = state.tributes[0];

  const secondPartner = state.tributes[1];

  if (!firstPartner || !secondPartner) {
    throw new Error("The test Game does not contain two tributes.");
  }

  const truce = createTruceInstance(
    `test-${kind}-truce`,

    [firstPartner.id, secondPartner.id],

    DAY_ONE,

    kind === "romantic" ? null : NIGHT_ONE,

    kind,
  );

  return {
    ...state,

    phase: "round-complete",

    currentRound: DAY_ONE,

    truces: [truce],

    roundEvents: [],

    revealedEventCount: 0,

    victoryOutcome: null,
  };
}

describe("poisonous berries joint victory", () => {
  it("is eligible for the final two tributes when they share a romantic truce", () => {
    const state = createFinalPairState("romantic");

    expect(selectLivingTributes(state)).toHaveLength(2);

    expect(isPoisonousBerriesFinaleEligible(state)).toBe(true);
  });

  it("is not eligible for the final two tributes when they share only a standard truce", () => {
    const state = createFinalPairState("standard");

    expect(isPoisonousBerriesFinaleEligible(state)).toBe(false);
  });

  it("is not eligible while a third tribute remains alive", () => {
    const state = createFinalPairState("romantic", 3);

    expect(selectLivingTributes(state)).toHaveLength(3);

    expect(isPoisonousBerriesFinaleEligible(state)).toBe(false);
  });

  it("resolves by declaring both romantic partners victorious", () => {
    const state = createFinalPairState("romantic");

    const partners = selectLivingTributes(state);

    const firstPartner = partners[0];

    const secondPartner = partners[1];

    if (!firstPartner || !secondPartner) {
      throw new Error("The test state does not contain two living partners.");
    }

    const resolution = POISONOUS_BERRIES_JOINT_VICTORY_EVENT.resolve({
      state,

      round: NIGHT_ONE,

      livingTributes: partners,

      eventId: "berries-finale",

      random: () => 0.5,

      participantsByRole: {
        partners,
      },
    });

    expect(resolution.changes).toContainEqual({
      type: "declare-victory",

      outcome: {
        kind: "joint",

        victorTributeIds: [firstPartner.id, secondPartner.id],

        sourceEventId: "berries-finale",

        reason: "poisonous-berries",
      },
    });
  });

  it("sequences only the poisonous berries event for the final romantic pair", () => {
    const state = createFinalPairState("romantic");

    const events = sequenceRoundEvents(state, NIGHT_ONE);

    expect(events).toHaveLength(1);

    expect(events[0]?.definitionId).toBe("poisonous-berries-joint-victory");

    expect(new Set(events[0]?.participantTributeIds)).toEqual(
      new Set(selectLivingTributes(state).map((tribute) => tribute.id)),
    );
  });

  it("enters joint victory after revealing the berries finale", () => {
    const state = createFinalPairState("romantic");

    const partners = selectLivingTributes(state);

    const events = sequenceRoundEvents(state, NIGHT_ONE);

    const berriesEvent = events[0];

    if (!berriesEvent) {
      throw new Error("The berries finale was not sequenced.");
    }

    const roundState: GameState = {
      ...state,

      phase: "round-events",

      currentRound: NIGHT_ONE,

      roundEvents: events,

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
      throw new Error("The Game unexpectedly disappeared.");
    }

    expect(nextState.phase).toBe("victory");

    expect(nextState.victoryOutcome).toEqual({
      kind: "joint",

      victorTributeIds: partners.map((tribute) => tribute.id),

      sourceEventId: berriesEvent.id,

      reason: "poisonous-berries",
    });

    expect(selectLivingTributes(nextState)).toHaveLength(2);

    expect(
      nextState.eventHistory.some(
        (event) => event.definitionId === "poisonous-berries-joint-victory",
      ),
    ).toBe(true);

    expect(nextState.truces).toHaveLength(1);

    expect(nextState.truces[0]?.kind).toBe("romantic");

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });
});
