import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";
import type { EventDefinition, EventResolutionContext } from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import type { GameState, GameTribute, RoundReference } from "~/game/types/game-state";

import { HIGH_LUCK_EVENTS } from "./high-events";
import { HIGH_LUCK_EXPANSION_EVENTS } from "./high-luck-expansion-events";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const satisfies RoundReference;

const NIGHT_TWO = {
  day: 2,
  period: "night",
} as const satisfies RoundReference;

function withLuck(tribute: GameTribute, luck: 1 | 2 | 3 | 4 | 5): GameTribute {
  return {
    ...tribute,
    snapshot: {
      ...tribute.snapshot,
      stats: {
        ...tribute.snapshot.stats,
        luck,
      },
    },
  };
}

function withStatus(tribute: GameTribute, statusId: "hungry" | "thirsty"): GameTribute {
  return {
    ...tribute,
    statuses: [
      ...tribute.statuses,
      createStatusEffectInstance(
        `fixture:${tribute.id}:${statusId}`,
        tribute.id,
        statusId,
        1,
        DAY_TWO,
      ),
    ],
  };
}

function requireEvent(id: string): EventDefinition {
  const definition = HIGH_LUCK_EXPANSION_EVENTS.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Missing High-Luck expansion event "${id}".`);
  }

  return definition;
}

function context(
  definition: EventDefinition,
  state: GameState,
  participantsByRole: EventResolutionContext["participantsByRole"],
  round: RoundReference = DAY_TWO,
  itemsByRole?: EventResolutionContext["itemsByRole"],
  randomValue = 0.5,
): EventResolutionContext {
  return {
    eventId: `test:${definition.id}`,
    state: {
      ...state,
      currentRound: round,
    },
    round,
    livingTributes: state.tributes.filter((tribute) => tribute.isAlive),
    participantsByRole,
    itemsByRole,
    random: () => randomValue,
  };
}

function selectedOwnedItem(actor: GameTribute) {
  const item = actor.inventory[0];

  if (!item) {
    throw new Error(`Missing selected item fixture for "${actor.id}".`);
  }

  return {
    actor: [
      {
        userTributeId: actor.id,
        owner: actor,
        item,
      },
    ],
  };
}

describe("remaining High-Luck catalogue", () => {
  it("registers twenty unique concepts beside the legacy event", () => {
    expect(HIGH_LUCK_EXPANSION_EVENTS).toHaveLength(20);
    expect(new Set(HIGH_LUCK_EXPANSION_EVENTS.map((event) => event.id)).size).toBe(20);
    expect(HIGH_LUCK_EVENTS).toHaveLength(21);
    expect(HIGH_LUCK_EVENTS).toContainEqual(expect.objectContaining({ id: "unexpected-pep-talk" }));

    for (const definition of HIGH_LUCK_EXPANSION_EVENTS) {
      expect(HIGH_LUCK_EVENTS).toContain(definition);
    }
  });

  it("contains nineteen Day concepts and one Night concept", () => {
    expect(
      HIGH_LUCK_EXPANSION_EVENTS.filter((event) => event.periods.includes("day")),
    ).toHaveLength(19);
    expect(
      HIGH_LUCK_EXPANSION_EVENTS.filter((event) => event.periods.includes("night")).map(
        (event) => event.id,
      ),
    ).toEqual(["high-luck-pinecone-alarm"]);
  });

  it("rejects low-Luck actors across the complete expansion", () => {
    const actor = withLuck(
      withStatus(
        withAuthoringTestItem(createAuthoringTestTribute({ id: "actor" }), "bow"),
        "hungry",
      ),
      3,
    );
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const roleContext = {
      state,
      round: DAY_TWO,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    for (const definition of HIGH_LUCK_EXPANSION_EVENTS) {
      const actorRole = definition.roles.find((role) => role.id === "actor");

      expect(actorRole?.isEligible, definition.id).toBeDefined();
      expect(actorRole?.isEligible?.(actor, roleContext), definition.id).toBe(false);
    }
  });

  it("resolves every authored hunger and thirst recovery", () => {
    const cases = [
      {
        id: "high-luck-personal-rain-cloud-useful",
        status: "thirsty",
        need: "water",
        itemId: null,
      },
      {
        id: "high-luck-bird-strike-special-delivery",
        status: "hungry",
        need: "food",
        itemId: null,
      },
      {
        id: "high-luck-foraging-dignity-restored",
        status: "hungry",
        need: "food",
        itemId: null,
      },
      {
        id: "high-luck-fishing-dignity-restored",
        status: "hungry",
        need: "food",
        itemId: null,
      },
      {
        id: "high-luck-berry-fortunate",
        status: "hungry",
        need: "food",
        itemId: null,
      },
      {
        id: "high-luck-last-sip-first-try",
        status: "thirsty",
        need: "water",
        itemId: null,
      },
      {
        id: "high-luck-spear-fishing-actual-success",
        status: "hungry",
        need: "food",
        itemId: "spear",
      },
    ] as const;

    for (const testCase of cases) {
      let actor = withLuck(
        withStatus(createAuthoringTestTribute({ id: `actor:${testCase.id}` }), testCase.status),
        5,
      );

      if (testCase.itemId) {
        actor = withAuthoringTestItem(actor, testCase.itemId);
      }

      const state = createAuthoringTestGame([actor]);
      const definition = requireEvent(testCase.id);
      const resolution = definition.resolve(
        context(
          definition,
          state,
          { actor: [actor] },
          DAY_TWO,
          testCase.itemId ? selectedOwnedItem(actor) : undefined,
        ),
      );

      expect(resolution.changes, testCase.id).toContainEqual({
        type: "satisfy-survival-need",
        tributeId: actor.id,
        need: testCase.need,
      });
    }
  });

  it("hides the actor through Camoufluke", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 4);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("high-luck-camoufluke");
    const resolution = definition.resolve(
      context(definition, state, {
        actor: [actor],
        target: [target],
      }),
    );

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "apply-status",
        tributeId: actor.id,
        status: expect.objectContaining({
          definitionId: "hidden",
        }),
      }),
    );
  });

  it("preserves the intended fatal loot contracts", () => {
    const lootEvents = [
      {
        id: "high-luck-stuck-in-the-mud-fortunate",
        itemId: null,
      },
      {
        id: "high-luck-step-on-a-wasp-nest-redirect",
        itemId: null,
      },
      {
        id: "high-luck-slippery-when-armed-fortunate",
        itemId: "knife",
      },
      {
        id: "high-luck-excalibur-fortunate",
        itemId: "knife",
      },
      {
        id: "high-luck-warning-shot-fortunate",
        itemId: "bow",
      },
      {
        id: "high-luck-terrible-throw-excellent-result",
        itemId: "bow",
      },
      {
        id: "high-luck-right-place-wrong-time-for-target",
        itemId: null,
      },
    ] as const;

    for (const testCase of lootEvents) {
      let actor = withLuck(createAuthoringTestTribute({ id: `actor:${testCase.id}` }), 5);

      if (testCase.itemId) {
        actor = withAuthoringTestItem(actor, testCase.itemId);
      }

      const target = withAuthoringTestItem(
        createAuthoringTestTribute({ id: `target:${testCase.id}` }),
        "med-kit",
      );
      const state = createAuthoringTestGame([actor, target]);
      const definition = requireEvent(testCase.id);
      const resolution = definition.resolve(
        context(
          definition,
          state,
          {
            actor: [actor],
            target: [target],
          },
          DAY_TWO,
          testCase.itemId ? selectedOwnedItem(actor) : undefined,
        ),
      );

      expect(resolution.changes, testCase.id).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: target.id,
          killerTributeIds: [actor.id],
        }),
      );
      expect(resolution.changes, testCase.id).toContainEqual(
        expect.objectContaining({
          type: "transfer-item",
          fromTributeId: target.id,
          toTributeId: actor.id,
        }),
      );

      if (testCase.itemId) {
        expect(resolution.changes, testCase.id).toContainEqual(
          expect.objectContaining({
            type: "use-item",
            tributeId: actor.id,
            itemInstanceId: actor.inventory[0]?.id,
          }),
        );
      }
    }
  });

  it("keeps no-loot deaths free of target inventory transfers", () => {
    const cases = [
      {
        id: "high-luck-tracker-jacked",
        itemId: null,
        killerIds: [],
      },
      {
        id: "high-luck-bow-to-chance",
        itemId: "bow",
        killerIds: ["actor"],
      },
      {
        id: "high-luck-safest-trip",
        itemId: null,
        killerIds: ["actor"],
      },
    ] as const;

    for (const testCase of cases) {
      let actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 5);

      if (testCase.itemId) {
        actor = withAuthoringTestItem(actor, testCase.itemId);
      }

      const target = withAuthoringTestItem(createAuthoringTestTribute({ id: "target" }), "med-kit");
      const state = createAuthoringTestGame([actor, target]);
      const definition = requireEvent(testCase.id);
      const resolution = definition.resolve(
        context(
          definition,
          state,
          {
            actor: [actor],
            target: [target],
          },
          DAY_TWO,
          testCase.itemId ? selectedOwnedItem(actor) : undefined,
        ),
      );

      expect(resolution.changes, testCase.id).toContainEqual(
        expect.objectContaining({
          type: "eliminate-tribute",
          tributeId: target.id,
          killerTributeIds: testCase.killerIds.length === 0 ? [] : [actor.id],
        }),
      );
      expect(
        resolution.changes.some(
          (change) => change.type === "transfer-item" && change.fromTributeId === target.id,
        ),
        testCase.id,
      ).toBe(false);
    }
  });

  it("records sheltered rest through Pinecone Alarm", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 4);
    const target = createAuthoringTestTribute({ id: "target" });
    const state = createAuthoringTestGame([actor, target]);
    const definition = requireEvent("high-luck-pinecone-alarm");
    const resolution = definition.resolve(
      context(
        definition,
        state,
        {
          actor: [actor],
          target: [target],
        },
        NIGHT_TWO,
      ),
    );

    expect(resolution.changes).toContainEqual({
      type: "record-night-rest",
      tributeId: actor.id,
      round: NIGHT_TWO,
      quality: "sheltered",
    });
  });

  it("leaves the designated carrier's truce inventory untouched", () => {
    const actor = withLuck(createAuthoringTestTribute({ id: "actor" }), 5);
    const mate = withAuthoringTestItem(createAuthoringTestTribute({ id: "mate" }), "med-kit");
    const baseState = createAuthoringTestGame([actor, mate]);
    const state: GameState = {
      ...baseState,
      truces: [
        createTruceInstance(
          "designated-carrier-fixture",
          [actor.id, mate.id],
          DAY_TWO,
          STANDARD_TRUCE_EXPIRY_ROUND,
        ),
      ],
    };
    const definition = requireEvent("high-luck-designated-carrier-fortunate");
    const roleContext = {
      state,
      round: DAY_TWO,
      livingTributes: state.tributes,
      participantsByRole: {},
    };

    expect(definition.roles[0]?.isEligible?.(actor, roleContext)).toBe(true);

    const resolution = definition.resolve(context(definition, state, { actor: [actor] }));

    expect(
      resolution.changes.some((change) =>
        ["transfer-item", "consume-item", "use-item", "acquire-item"].includes(change.type),
      ),
    ).toBe(false);
  });
});
