// Phase 3 recovery-priority tests.
import { describe, expect, it } from "vitest";

import {
  createEventCandidateSelectionSeed,
  createFeasibleEventCandidates,
  selectFeasibleEventCandidate,
} from "~/game/engine/event-candidate-selection";
import { createSeededRandom } from "~/game/engine/random";
import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import {
  getEventSelectionRecoveryPriorityBreakdown,
  getParticipantRecoveryPriorityMultiplier,
  getRecoveryPriorityMultiplier,
} from "~/game/events/event-recovery-priority";
import type { EventDefinition, EventSelectionContext } from "~/game/events/event-schema";
import { selectEventParticipants } from "~/game/events/participant-selection";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameTribute, StatusEffect } from "~/game/types/game-state";

const DAY_ROUND = {
  day: 2,
  period: "day",
} as const;

function withStatus(
  tribute: GameTribute,
  definitionId: "hungry" | "thirsty" | "injured",
  severity: 1 | 2 | 3,
): GameTribute {
  const status: StatusEffect = createStatusEffectInstance(
    "recovery-priority-fixture",
    tribute.id,
    definitionId,
    severity,
    DAY_ROUND,
  );

  return {
    ...tribute,
    statuses: [status],
  };
}

function createContext(tributes: readonly GameTribute[]): EventSelectionContext {
  const state = {
    ...createAuthoringTestGame(tributes),
    seed: "recovery-priority-test",
    currentRound: DAY_ROUND,
  };

  return {
    state,
    round: DAY_ROUND,
    livingTributes: state.tributes,
  };
}

function createDefinition(
  id: string,
  recoveryProfile?: EventDefinition["recoveryProfile"],
): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    ...(recoveryProfile
      ? {
          recoveryProfile,
        }
      : {}),
    roles: [
      {
        id: "actor",
        count: 1,
      },
    ],
    resolve: () => ({
      text: "A test event occurs.",
      changes: [],
    }),
  };
}

describe("event recovery priority", () => {
  it("uses the configured severity tiers", () => {
    expect(getRecoveryPriorityMultiplier(0)).toBe(1);
    expect(getRecoveryPriorityMultiplier(1)).toBe(2.5);
    expect(getRecoveryPriorityMultiplier(2)).toBe(4);
    expect(getRecoveryPriorityMultiplier(3)).toBe(6);
  });

  it("boosts only when the feasible role participant has the active problem", () => {
    const healthy = createAuthoringTestTribute({
      id: "healthy",
    });
    const injured = withStatus(
      createAuthoringTestTribute({
        id: "injured",
      }),
      "injured",
      2,
    );

    const definition = createDefinition("wound-treatment", {
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["injured"],
        },
      ],
    });

    const healthySelection = {
      participantsByRole: {
        actor: [healthy],
      },
      participantTributeIds: [healthy.id],
      itemsByRole: {},
      selectedItemInstanceIds: [],
    };

    const injuredSelection = {
      participantsByRole: {
        actor: [injured],
      },
      participantTributeIds: [injured.id],
      itemsByRole: {},
      selectedItemInstanceIds: [],
    };

    expect(getEventSelectionRecoveryPriorityBreakdown(definition, healthySelection)).toMatchObject({
      severity: 0,
      multiplier: 1,
    });

    expect(getEventSelectionRecoveryPriorityBreakdown(definition, injuredSelection)).toMatchObject({
      severity: 2,
      multiplier: 4,
      activeTributeIds: [injured.id],
      activeTargetKinds: ["status"],
    });
  });

  it("maps hunger recovery targets to the hungry status", () => {
    const hungry = withStatus(
      createAuthoringTestTribute({
        id: "hungry",
      }),
      "hungry",
      1,
    );

    const definition = createDefinition("find-food", {
      targets: [
        {
          kind: "survival-need",
          roleId: "actor",
          need: "food",
        },
      ],
    });

    expect(getParticipantRecoveryPriorityMultiplier(definition, "actor", hungry)).toBe(5);
  });

  it("strongly favours the participant who can benefit without guaranteeing them", () => {
    const healthy = createAuthoringTestTribute({
      id: "healthy",
    });
    const injured = withStatus(
      createAuthoringTestTribute({
        id: "injured",
      }),
      "injured",
      2,
    );

    const definition = createDefinition("participant-priority", {
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["injured"],
        },
      ],
    });

    const context = createContext([healthy, injured]);
    const random = createSeededRandom("participant-recovery-distribution");

    let injuredSelections = 0;
    const iterations = 10_000;

    for (let index = 0; index < iterations; index += 1) {
      const selection = selectEventParticipants(
        definition,
        context,
        random,
        new Set<string>(),
        new Set<string>(),
      );

      if (selection?.participantTributeIds[0] === injured.id) {
        injuredSelections += 1;
      }
    }

    const rate = injuredSelections / iterations;

    expect(rate).toBeGreaterThan(0.86);
    expect(rate).toBeLessThan(0.91);
  });

  it("gives a severity-two recovery candidate four times the general event weight", () => {
    const injured = withStatus(
      createAuthoringTestTribute({
        id: "injured",
      }),
      "injured",
      2,
    );

    const context = createContext([injured]);
    const generic = createDefinition("generic-event");
    const recovery = createDefinition("recovery-event", {
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["injured"],
        },
      ],
    });

    const candidates = createFeasibleEventCandidates({
      definitions: [generic, recovery],
      context,
      unavailableTributeIds: new Set<string>(),
      unavailableItemInstanceIds: new Set<string>(),
      selectionSeed: createEventCandidateSelectionSeed(context.state.seed, context.round, 0),
    });

    const byId = new Map(
      candidates.map((candidate) => [candidate.definition.id, candidate.effectiveWeight]),
    );

    expect(byId.get("recovery-event")).toBeCloseTo((byId.get("generic-event") ?? 0) * 4, 10);

    const random = createSeededRandom("recovery-event-distribution");
    let recoverySelections = 0;
    const iterations = 10_000;

    for (let index = 0; index < iterations; index += 1) {
      const selected = selectFeasibleEventCandidate(candidates, random);

      if (selected?.definition.id === recovery.id) {
        recoverySelections += 1;
      }
    }

    const rate = recoverySelections / iterations;

    expect(rate).toBeGreaterThan(0.77);
    expect(rate).toBeLessThan(0.83);
  });
});
