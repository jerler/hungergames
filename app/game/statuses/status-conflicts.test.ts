import { describe, expect, it } from "vitest";

import { createAuthoringTestTribute } from "~/game/events/authoring/testing/authoring-test-fixtures";

import type { GameTribute, StatusEffect } from "~/game/types/game-state";

import type { StatusEffectId } from "./status-schema";

import {
  assertValidStatusCombination,
  getConflictingStatusIds,
  removeConflictingStatuses,
} from "./status-conflicts";

import { createStatusEffectInstance, upsertStatusEffect } from "./status-engine";

const PREVIOUS_ROUND = {
  day: 1,
  period: "night",
} as const;

function createStatus(
  statusId: StatusEffectId,
  {
    eventId = `status-${statusId}`,

    severity = 1,

    durationRounds,
  }: {
    eventId?: string;

    severity?: 1 | 2 | 3;

    durationRounds?: number;
  } = {},
): StatusEffect {
  return createStatusEffectInstance(
    eventId,
    "status-conflict-tribute",
    statusId,
    severity,
    PREVIOUS_ROUND,
    durationRounds,
  );
}

function getStatusIds(statuses: readonly StatusEffect[]): StatusEffectId[] {
  return statuses.map((status) => status.definitionId);
}

function createTributeWithStatuses(statuses: readonly StatusEffect[]): GameTribute {
  return {
    ...createAuthoringTestTribute({
      id: "status-conflict-tribute",
    }),

    statuses: [...statuses],
  };
}

describe("status conflict definitions", () => {
  it("defines the hunger conflicts", () => {
    expect(getConflictingStatusIds("well-fed")).toEqual(["hungry"]);

    expect(getConflictingStatusIds("hungry")).toEqual(["well-fed"]);
  });

  it("defines the rest conflicts", () => {
    expect(getConflictingStatusIds("well-rested")).toEqual(["exhausted"]);

    expect(getConflictingStatusIds("alert")).toEqual(["exhausted"]);

    expect(getConflictingStatusIds("exhausted")).toEqual(["well-rested", "alert"]);
  });

  it("does not make alert and well-rested conflict", () => {
    expect(getConflictingStatusIds("alert")).not.toContain("well-rested");

    expect(getConflictingStatusIds("well-rested")).not.toContain("alert");
  });
});

describe("removeConflictingStatuses", () => {
  it("removes only statuses that conflict with the incoming status", () => {
    const statuses = [createStatus("hungry"), createStatus("injured"), createStatus("exhausted")];

    const result = removeConflictingStatuses(statuses, "well-fed");

    expect(getStatusIds(result)).toEqual(["injured", "exhausted"]);
  });

  it("preserves all statuses when the incoming status has no conflicts", () => {
    const statuses = [createStatus("injured"), createStatus("lucky")];

    expect(getStatusIds(removeConflictingStatuses(statuses, "hidden"))).toEqual([
      "injured",
      "lucky",
    ]);
  });
});

describe("upsertStatusEffect conflict handling", () => {
  it.each([
    {
      existing: "hungry",
      incoming: "well-fed",
    },

    {
      existing: "well-fed",
      incoming: "hungry",
    },

    {
      existing: "exhausted",
      incoming: "well-rested",
    },

    {
      existing: "exhausted",
      incoming: "alert",
    },

    {
      existing: "well-rested",
      incoming: "exhausted",
    },

    {
      existing: "alert",
      incoming: "exhausted",
    },
  ] as const)("applying $incoming removes $existing", ({ existing, incoming }) => {
    const result = upsertStatusEffect(
      [createStatus(existing)],

      createStatus(incoming, {
        eventId: `incoming-${incoming}`,
      }),
    );

    expect(getStatusIds(result)).toContain(incoming);

    expect(getStatusIds(result)).not.toContain(existing);
  });

  it("allows alert and well-rested to coexist", () => {
    const result = upsertStatusEffect(
      [createStatus("well-rested")],

      createStatus("alert"),
    );

    expect(getStatusIds(result)).toEqual(["well-rested", "alert"]);
  });

  it("preserves unrelated statuses", () => {
    const result = upsertStatusEffect(
      [createStatus("injured"), createStatus("lucky"), createStatus("hungry")],

      createStatus("well-fed"),
    );

    expect(getStatusIds(result)).toEqual(["injured", "lucky", "well-fed"]);
  });

  it("continues merging duplicate severity and duration", () => {
    const existing = createStatus("injured", {
      eventId: "existing-injury",

      severity: 1,

      durationRounds: 1,
    });

    const incoming = createStatus("injured", {
      eventId: "incoming-injury",

      severity: 2,

      durationRounds: 3,
    });

    const result = upsertStatusEffect([existing], incoming);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      /*
       * Preserve the original instance identity,
       * matching the existing reducer behaviour.
       */
      id: existing.id,

      definitionId: "injured",

      severity: 3,

      remainingRounds: 3,
    });
  });

  it("produces deterministic results", () => {
    const statuses = [createStatus("hungry"), createStatus("injured")];

    const incoming = createStatus("well-fed");

    expect(upsertStatusEffect(statuses, incoming)).toEqual(upsertStatusEffect(statuses, incoming));
  });
});

describe("assertValidStatusCombination", () => {
  it.each([
    ["well-fed", "hungry"],

    ["well-rested", "exhausted"],

    ["alert", "exhausted"],
  ] as const)("rejects %s with %s", (firstStatusId, secondStatusId) => {
    const tribute = createTributeWithStatuses([
      createStatus(firstStatusId),

      createStatus(secondStatusId),
    ]);

    expect(() => assertValidStatusCombination(tribute)).toThrow(/cannot have both/i);
  });

  it("allows alert with well-rested", () => {
    const tribute = createTributeWithStatuses([createStatus("alert"), createStatus("well-rested")]);

    expect(() => assertValidStatusCombination(tribute)).not.toThrow();
  });

  it("allows unrelated harmful and beneficial statuses", () => {
    const tribute = createTributeWithStatuses([
      createStatus("injured"),

      createStatus("lucky"),

      createStatus("hidden"),
    ]);

    expect(() => assertValidStatusCombination(tribute)).not.toThrow();
  });
});
