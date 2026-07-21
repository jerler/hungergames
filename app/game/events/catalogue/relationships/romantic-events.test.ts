import { describe, expect, it } from "vitest";

import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import type { RandomSource } from "~/game/engine/random";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import {
  isPoisonousBerriesFinaleEligible,
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT,
  ROMANTIC_EVENTS,
} from "./romantic-events";
import { sequenceRoundEvents } from "~/game/engine/event-sequencer";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { gameReducer } from "~/state/game-reducer";
import { STANDARD_DISSOLUTION_EVENTS } from "~/game/events/catalogue/relationships/standard-dissolution-events";
import { STANDARD_FORMATION_EVENTS } from "~/game/events/catalogue/relationships/standard-formation-events";
import { STANDARD_INTERACTION_EVENTS } from "~/game/events/catalogue/relationships/standard-interaction-events";
import type {
  EventDefinition,
  EventResolution,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createTruceInstance, expireTrucesAfterRound } from "~/game/truces/truce-engine";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const NIGHT_ONE = {
  day: 1,
  period: "night",
} as const;

const BALANCED_STATS = {
  brains: 3,
  brawn: 3,
  luck: 3,
} satisfies TributeStats;

interface RomanticTruceFixture {
  state: GameState;
  firstPartner: GameTribute;
  secondPartner: GameTribute;
}

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

      seed: "romantic-truce-event-tests",

      now: "2026-07-20T12:00:00.000Z",
    },
  );
}

function withStats(tribute: GameTribute, stats: TributeStats): GameTribute {
  return {
    ...tribute,

    snapshot: {
      ...tribute.snapshot,

      stats: {
        ...stats,
      },
    },
  };
}

function createSequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  const fallback = values[values.length - 1] ?? 0.5;

  return () => {
    const value = values[index] ?? fallback;

    index += 1;

    return value;
  };
}

function requireRomanticEvent(eventId: string): EventDefinition {
  const definition = ROMANTIC_EVENTS.find((candidate) => candidate.id === eventId);

  if (!definition) {
    throw new Error(`Missing romantic event "${eventId}".`);
  }

  return definition;
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
    const summary = `${tribute.snapshot.name} was eliminated ` + "during test setup.";

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

function createJointVictoryEvent(
  state: GameState,
  options: {
    id?: string;
    definitionId?: string;
    sourceEventId?: string;
  } = {},
): ResolvedEvent {
  const partners = selectLivingTributes(state).slice(0, 2);

  const firstPartner = partners[0];
  const secondPartner = partners[1];

  if (!firstPartner || !secondPartner) {
    throw new Error("The joint-victory test requires two living tributes.");
  }

  const eventId = options.id ?? "test-berries-finale";

  return {
    id: eventId,

    definitionId: options.definitionId ?? "poisonous-berries-joint-victory",

    resolutionMode: "standard",
    round: NIGHT_ONE,

    participantTributeIds: [firstPartner.id, secondPartner.id],

    text: "The finalists threaten to eat poisonous berries.",

    changes: [
      {
        type: "declare-victory",

        outcome: {
          kind: "joint",

          victorTributeIds: [firstPartner.id, secondPartner.id],

          sourceEventId: options.sourceEventId ?? eventId,

          reason: "poisonous-berries",
        },
      },
    ],
  };
}

function resolveEvent(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: ParticipantsByRole,
  randomValues: readonly number[],
  eventId = `resolved:${definition.id}`,
): EventResolution {
  return definition.resolve({
    state,
    round: DAY_ONE,

    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),

    eventId,

    random: createSequenceRandom(randomValues),

    participantsByRole,
  });
}

function applyResolution(
  state: GameState,
  definition: EventDefinition,
  participantTributeIds: readonly string[],
  resolution: EventResolution,
  eventId = `resolved:${definition.id}`,
): GameState {
  const event: ResolvedEvent = {
    id: eventId,

    definitionId: definition.id,

    resolutionMode: "standard",

    round: DAY_ONE,

    participantTributeIds: [...participantTributeIds],

    text: resolution.text,
    changes: resolution.changes,
  };

  return applyResolvedEvent(state, event);
}

function createRomanticTruceState(): RomanticTruceFixture {
  const game = createGame();

  const [firstOriginal, secondOriginal] = game.tributes;

  if (!firstOriginal || !secondOriginal) {
    throw new Error("Romantic truce tests require at least two tributes.");
  }

  const firstPartner = withStats(firstOriginal, BALANCED_STATS);

  const secondPartner = withStats(secondOriginal, BALANCED_STATS);

  const stateWithStats: GameState = {
    ...game,

    tributes: game.tributes.map((tribute) => {
      if (tribute.id === firstPartner.id) {
        return firstPartner;
      }

      if (tribute.id === secondPartner.id) {
        return secondPartner;
      }

      return tribute;
    }),
  };

  const truce = createTruceInstance(
    "setup-romantic-truce",
    [firstPartner.id, secondPartner.id],
    DAY_ONE,
    null,
    "romantic",
  );

  const state = applyResolvedEvent(
    stateWithStats,

    {
      id: "setup-romantic-truce-event",

      definitionId: "setup-romantic-truce",

      resolutionMode: "standard",

      round: DAY_ONE,

      participantTributeIds: [firstPartner.id, secondPartner.id],

      text: "A romantic truce forms for testing.",

      changes: [
        {
          type: "form-truce",

          truce,
        },
      ],
    },
  );

  const resultingFirstPartner = state.tributes.find((tribute) => tribute.id === firstPartner.id);

  const resultingSecondPartner = state.tributes.find((tribute) => tribute.id === secondPartner.id);

  if (!resultingFirstPartner || !resultingSecondPartner) {
    throw new Error("Romantic truce members could not be recovered from state.");
  }

  return {
    state,

    firstPartner: resultingFirstPartner,

    secondPartner: resultingSecondPartner,
  };
}

describe("romantic events", () => {
  it("includes every romantic event in the main catalogue", () => {
    expect(
      ROMANTIC_EVENTS.every((event) =>
        EVENT_CATALOGUE.some((candidate) => candidate.id === event.id),
      ),
    ).toBe(true);
  });

  it("keeps romantic formation substantially rarer than standard pair formation", () => {
    const romanticFormation = requireRomanticEvent("romantic-truce-formation");

    const standardFormation = STANDARD_FORMATION_EVENTS.find(
      (event) => event.id === "share-shelter-truce-2",
    );

    if (!standardFormation) {
      throw new Error("Missing standard two-person truce formation event.");
    }

    expect(romanticFormation.baseWeight).toBeLessThan(standardFormation.baseWeight);
  });

  it("forms a permanent two-person romantic truce", () => {
    const game = createGame();

    const definition = requireRomanticEvent("romantic-truce-formation");

    const participants = game.tributes.slice(0, 2);

    expect(participants).toHaveLength(2);

    const resolution = resolveEvent(
      definition,
      game,
      {
        tributes: participants,
      },
      [0.5],
      "romantic-formation-test",
    );

    expect(resolution.changes).toContainEqual({
      type: "form-truce",

      truce: expect.objectContaining({
        kind: "romantic",

        tributeIds: participants.map((tribute) => tribute.id),

        createdRound: DAY_ONE,

        expiresAfterRound: null,
      }),
    });

    const nextState = applyResolution(
      game,
      definition,

      participants.map((tribute) => tribute.id),

      resolution,

      "romantic-formation-test",
    );

    expect(nextState.truces).toHaveLength(1);

    expect(nextState.truces[0]).toMatchObject({
      kind: "romantic",

      expiresAfterRound: null,
    });

    for (const participant of participants) {
      const resultingTribute = nextState.tributes.find((tribute) => tribute.id === participant.id);

      expect(resultingTribute?.statuses.some((status) => status.definitionId === "inspired")).toBe(
        true,
      );

      expect(resultingTribute?.statistics.eventsSurvived).toBe(1);
    }

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("cannot form when only three tributes remain", () => {
    const game = createGame();

    const definition = requireRomanticEvent("romantic-truce-formation");

    const finalThree = game.tributes.slice(0, 3);

    expect(
      definition.isEligible?.({
        state: game,
        round: DAY_ONE,

        livingTributes: finalThree,
      }),
    ).toBe(false);
  });

  it("only selects tributes who are not already in a truce", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-truce-formation");

    const role = definition.roles[0];

    expect(
      role.isEligible?.(
        firstPartner,

        {
          state,
          round: DAY_ONE,

          livingTributes: state.tributes,

          participantsByRole: {},
        },
      ),
    ).toBe(false);

    expect(
      role.isEligible?.(
        secondPartner,

        {
          state,
          round: DAY_ONE,

          livingTributes: state.tributes,

          participantsByRole: {},
        },
      ),
    ).toBe(false);

    const outsider = state.tributes.find(
      (tribute) => tribute.id !== firstPartner.id && tribute.id !== secondPartner.id,
    );

    if (!outsider) {
      throw new Error("Missing unaligned tribute.");
    }

    expect(
      role.isEligible?.(
        outsider,

        {
          state,
          round: DAY_ONE,

          livingTributes: state.tributes,

          participantsByRole: {},
        },
      ),
    ).toBe(true);
  });

  it("does not allow romantic truces into ordinary breakup events", () => {
    const { state } = createRomanticTruceState();

    const amicableSeparation = STANDARD_DISSOLUTION_EVENTS.find(
      (event) => event.id === "amicable-truce-separation-2",
    );

    const betrayal = STANDARD_INTERACTION_EVENTS.find((event) => event.id === "truce-betrayal-2");

    const standardProtection = STANDARD_INTERACTION_EVENTS.find(
      (event) => event.id === "protects-truce-partner",
    );

    if (!amicableSeparation || !betrayal || !standardProtection) {
      throw new Error("Missing standard truce dissolution or conflict event.");
    }

    const context = {
      state,
      round: DAY_ONE,

      livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    };

    expect(amicableSeparation.isEligible?.(context)).toBe(false);

    expect(betrayal.isEligible?.(context)).toBe(false);

    expect(standardProtection.isEligible?.(context)).toBe(false);
  });

  it("does not expire a romantic truce", () => {
    const { state } = createRomanticTruceState();

    const nextState = expireTrucesAfterRound({
      ...state,

      currentRound: {
        day: 20,
        period: "night",
      },
    });

    expect(nextState.truces).toHaveLength(1);

    expect(nextState.truces[0]).toMatchObject({
      kind: "romantic",

      expiresAfterRound: null,
    });

    expect(nextState.eventHistory.some((event) => event.definitionId === "truce-expired")).toBe(
      false,
    );
  });

  it("selects a protection target from the protector's romantic truce", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const outsider = state.tributes.find(
      (tribute) => tribute.id !== firstPartner.id && tribute.id !== secondPartner.id,
    );

    if (!outsider) {
      throw new Error("Missing outsider for protection selection test.");
    }

    const definition = requireRomanticEvent("romantic-partner-protection");

    const selection = selectEventParticipants(
      definition,

      {
        state,
        round: DAY_ONE,

        livingTributes: [firstPartner, secondPartner, outsider],
      },

      createSequenceRandom([0, 0.999]),

      new Set(),
    );

    expect(selection).not.toBeNull();

    expect(new Set(selection?.participantTributeIds)).toEqual(
      new Set([firstPartner.id, secondPartner.id]),
    );

    expect(selection?.participantTributeIds).not.toContain(outsider.id);
  });

  it("reaches all four romantic protection outcomes", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-partner-protection");

    const resolveWithRandom = (randomValue: number) =>
      resolveEvent(
        definition,
        state,

        {
          protector: [firstPartner],

          partner: [secondPartner],
        },

        [randomValue],
      );

    const criticalFailure = resolveWithRandom(0);

    const failure = resolveWithRandom(0.2);

    const success = resolveWithRandom(0.6);

    const exceptionalSuccess = resolveWithRandom(0.999);

    expect(
      criticalFailure.changes.some(
        (change) => change.type === "eliminate-tribute" && change.tributeId === firstPartner.id,
      ),
    ).toBe(true);

    expect(
      failure.changes.some(
        (change) =>
          change.type === "apply-status" &&
          change.tributeId === firstPartner.id &&
          change.status.definitionId === "injured",
      ),
    ).toBe(true);

    expect(success.changes.some((change) => change.type === "eliminate-tribute")).toBe(false);

    expect(success.changes.filter((change) => change.type === "increment-statistic")).toHaveLength(
      2,
    );

    expect(
      exceptionalSuccess.changes.filter(
        (change) => change.type === "apply-status" && change.status.definitionId === "inspired",
      ),
    ).toHaveLength(2);

    expect(
      new Set([criticalFailure.text, failure.text, success.text, exceptionalSuccess.text]).size,
    ).toBe(4);
  });

  it("uses emotional aftermath when one romantic partner dies", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-partner-protection");

    const eventId = "fatal-romantic-protection";

    const resolution = resolveEvent(
      definition,
      state,

      {
        protector: [firstPartner],

        partner: [secondPartner],
      },

      [0],

      eventId,
    );

    const nextState = applyResolution(
      state,
      definition,

      [firstPartner.id, secondPartner.id],

      resolution,

      eventId,
    );

    const resultingProtector = nextState.tributes.find((tribute) => tribute.id === firstPartner.id);

    const survivingPartner = nextState.tributes.find((tribute) => tribute.id === secondPartner.id);

    expect(resultingProtector?.isAlive).toBe(false);

    expect(survivingPartner?.isAlive).toBe(true);

    expect(nextState.truces).toEqual([]);

    const aftermathEvent = nextState.eventHistory.find(
      (event) => event.definitionId === "romantic-truce-ended-by-death",
    );

    expect(aftermathEvent).toBeDefined();

    expect(aftermathEvent?.text).toContain("devastated");

    expect(aftermathEvent?.participantTributeIds).toEqual(
      expect.arrayContaining([firstPartner.id, secondPartner.id]),
    );

    expect(survivingPartner?.statuses).toContainEqual(
      expect.objectContaining({
        definitionId: "disoriented",

        severity: 2,
      }),
    );

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("keeps the romantic truce active after failed but nonfatal protection", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-partner-protection");

    const eventId = "injured-romantic-protection";

    const resolution = resolveEvent(
      definition,
      state,

      {
        protector: [firstPartner],

        partner: [secondPartner],
      },

      [0.2],

      eventId,
    );

    const nextState = applyResolution(
      state,
      definition,

      [firstPartner.id, secondPartner.id],

      resolution,

      eventId,
    );

    expect(nextState.truces).toHaveLength(1);

    expect(nextState.truces[0].kind).toBe("romantic");

    expect(
      nextState.tributes.find((tribute) => tribute.id === firstPartner.id)?.statuses,
    ).toContainEqual(
      expect.objectContaining({
        definitionId: "injured",

        severity: 2,
      }),
    );

    expect(
      nextState.tributes.find((tribute) => tribute.id === secondPartner.id)?.statuses,
    ).toContainEqual(
      expect.objectContaining({
        definitionId: "inspired",
      }),
    );

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("keeps the romantic truce active after successful protection", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-partner-protection");

    const eventId = "successful-romantic-protection";

    const resolution = resolveEvent(
      definition,
      state,

      {
        protector: [firstPartner],

        partner: [secondPartner],
      },

      [0.6],

      eventId,
    );

    const nextState = applyResolution(
      state,
      definition,

      [firstPartner.id, secondPartner.id],

      resolution,

      eventId,
    );

    expect(nextState.truces).toHaveLength(1);

    expect(nextState.truces[0]).toMatchObject({
      kind: "romantic",

      tributeIds: expect.arrayContaining([firstPartner.id, secondPartner.id]),

      expiresAfterRound: null,
    });

    expect(nextState.tributes.find((tribute) => tribute.id === firstPartner.id)?.isAlive).toBe(
      true,
    );

    expect(nextState.tributes.find((tribute) => tribute.id === secondPartner.id)?.isAlive).toBe(
      true,
    );

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("inspires both partners after exceptional protection", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-partner-protection");

    const eventId = "exceptional-romantic-protection";

    const resolution = resolveEvent(
      definition,
      state,

      {
        protector: [firstPartner],

        partner: [secondPartner],
      },

      [0.999],

      eventId,
    );

    const nextState = applyResolution(
      state,
      definition,

      [firstPartner.id, secondPartner.id],

      resolution,

      eventId,
    );

    for (const partnerId of [firstPartner.id, secondPartner.id]) {
      expect(
        nextState.tributes.find((tribute) => tribute.id === partnerId)?.statuses,
      ).toContainEqual(
        expect.objectContaining({
          definitionId: "inspired",

          severity: 2,
        }),
      );
    }

    expect(nextState.truces).toHaveLength(1);

    expect(() => assertGameStateInvariants(nextState)).not.toThrow();
  });

  it("resolves romantic protection deterministically", () => {
    const { state, firstPartner, secondPartner } = createRomanticTruceState();

    const definition = requireRomanticEvent("romantic-partner-protection");

    const resolve = () =>
      resolveEvent(
        definition,
        state,

        {
          protector: [firstPartner],

          partner: [secondPartner],
        },

        [0.999],

        "deterministic-romantic-protection",
      );

    expect(resolve()).toEqual(resolve());
  });

  // Nested describe for the poisonous berries joint victory tests
  describe("poisonous berries joint victory", () => {
    it("is eligible for the final two tributes " + "when they share a romantic truce", () => {
      const state = createFinalPairState("romantic");

      expect(selectLivingTributes(state)).toHaveLength(2);

      expect(isPoisonousBerriesFinaleEligible(state)).toBe(true);
    });

    it(
      "is not eligible for the final two tributes " + "when they share only a standard truce",
      () => {
        const state = createFinalPairState("standard");

        expect(isPoisonousBerriesFinaleEligible(state)).toBe(false);
      },
    );

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

    it("rejects joint victory while another tribute remains alive", () => {
      const state = createFinalPairState("romantic", 3);

      expect(() => applyResolvedEvent(state, createJointVictoryEvent(state))).toThrow(
        /every living tribute must be included/i,
      );
    });

    it("rejects joint victory from an event other than " + "the berries finale", () => {
      const state = createFinalPairState("romantic");

      expect(() =>
        applyResolvedEvent(
          state,

          createJointVictoryEvent(state, {
            definitionId: "ordinary-survival-event",
          }),
        ),
      ).toThrow(/only be declared by the poisonous-berries finale/i);
    });

    it("rejects joint victory that references " + "a different source event", () => {
      const state = createFinalPairState("romantic");

      expect(() =>
        applyResolvedEvent(
          state,

          createJointVictoryEvent(state, {
            id: "actual-berries-event",
            sourceEventId: "different-event",
          }),
        ),
      ).toThrow(/must reference the event that declared it/i);
    });

    it("rejects joint victory for finalists " + "outside a romantic truce", () => {
      const state = createFinalPairState("standard");

      expect(() => applyResolvedEvent(state, createJointVictoryEvent(state))).toThrow(
        /same active romantic truce/i,
      );
    });

    it("sequences only the poisonous berries event " + "for the final romantic pair", () => {
      const state = createFinalPairState("romantic");

      const events = sequenceRoundEvents(state, NIGHT_ONE);

      expect(events).toHaveLength(1);

      expect(events[0]?.definitionId).toBe("poisonous-berries-joint-victory");

      expect(new Set(events[0]?.participantTributeIds)).toEqual(
        new Set(selectLivingTributes(state).map((tribute) => tribute.id)),
      );
    });

    it("enters joint victory after revealing " + "the berries finale", () => {
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

      const nextState = gameReducer(roundState, {
        type: "event/revealed",
        now: "2026-07-20T12:01:00.000Z",
      });

      if (!nextState) {
        throw new Error("The Game unexpectedly disappeared.");
      }

      expect(nextState.phase).toBe("victory");

      expect(nextState.victoryOutcome).toMatchObject({
        kind: "joint",
        sourceEventId: berriesEvent.id,
        reason: "poisonous-berries",
      });

      if (nextState.victoryOutcome?.kind !== "joint") {
        throw new Error("The berries finale did not produce a joint victory.");
      }

      expect(new Set(nextState.victoryOutcome.victorTributeIds)).toEqual(
        new Set(partners.map((tribute) => tribute.id)),
      );

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
});
