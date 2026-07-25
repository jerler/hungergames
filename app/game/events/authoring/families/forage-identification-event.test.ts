import { describe, expect, it } from "vitest";

import { createSeededRandom } from "~/game/engine/random";

import {
  AUTHORING_TEST_ROUND,
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import {
  getAcquiredItemIds,
  getAppliedStatusIds,
  hasSurvivalCredit,
  selectAndResolveEvent,
} from "~/game/events/testing/event-test-helpers";

import { createTruceInstance } from "~/game/truces/truce-engine";

import type { GameState, GameTribute } from "~/game/types/game-state";

import {
  createForageIdentificationEvent,
  selectHiddenForageType,
  type HiddenForageType,
} from "./forage-identification-event";

const BERRY_EVENT = createForageIdentificationEvent("test-berry-foraging", {
  forageLabel: "berries",

  items: {
    safe: "wild-fruit",

    hallucinogenic: "hallucinogenic-berries",

    poisonous: "poison-berries",
  },
});

function createForager(brains: 1 | 2 | 3 | 4 | 5): GameTribute {
  return createAuthoringTestTribute({
    id: "forager",

    name: "Katniss",

    stats: {
      brains,
      brawn: 3,
      luck: 3,
    },
  });
}

describe("selectHiddenForageType", () => {
  it("approximates the planned 50/25/25 distribution", () => {
    const random = createSeededRandom("forage-distribution");

    const counts: Record<HiddenForageType, number> = {
      safe: 0,
      hallucinogenic: 0,
      poisonous: 0,
    };

    const samples = 20_000;

    for (let index = 0; index < samples; index += 1) {
      counts[selectHiddenForageType(random)] += 1;
    }

    expect(counts.safe / samples).toBeGreaterThan(0.48);

    expect(counts.safe / samples).toBeLessThan(0.52);

    expect(counts.hallucinogenic / samples).toBeGreaterThan(0.23);

    expect(counts.hallucinogenic / samples).toBeLessThan(0.27);

    expect(counts.poisonous / samples).toBeGreaterThan(0.23);

    expect(counts.poisonous / samples).toBeLessThan(0.27);
  });

  it("produces deterministic hidden-type sequences", () => {
    const selectSequence = (seed: string) => {
      const random = createSeededRandom(seed);

      return Array.from(
        {
          length: 100,
        },

        () => selectHiddenForageType(random),
      );
    };

    expect(selectSequence("forage-sequence")).toEqual(selectSequence("forage-sequence"));
  });
});

describe("createForageIdentificationEvent", () => {
  it("acquires safe forage with natural provenance", () => {
    const tribute = createForager(3);

    const state = createAuthoringTestGame([tribute]);

    const { resolution } = selectAndResolveEvent({
      definition: BERRY_EVENT,

      state,

      livingTributes: [tribute],

      /*
       * 0.1 selects safe forage.
       * 0 fails identification, but the
       * selected forage is still safe.
       */
      randomValues: [0.1, 0],
    });

    expect(getAcquiredItemIds(resolution)).toEqual(["wild-fruit"]);

    expect(resolution.changes).toContainEqual(
      expect.objectContaining({
        type: "acquire-item",

        acquisitionSource: "natural-foraging",

        item: expect.objectContaining({
          definitionId: "wild-fruit",
        }),
      }),
    );

    expect(hasSurvivalCredit(resolution, tribute.id)).toBe(true);
  });

  it("applies disoriented after failed hallucinogenic identification", () => {
    const tribute = createForager(3);

    const { resolution } = selectAndResolveEvent({
      definition: BERRY_EVENT,

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      /*
       * 0.6 selects hallucinogenic.
       * 0 fails identification.
       */
      randomValues: [0.6, 0],
    });

    expect(getAppliedStatusIds(resolution)).toEqual(["disoriented"]);

    expect(getAcquiredItemIds(resolution)).toEqual([]);
  });

  it("applies poisoned after failed poisonous identification", () => {
    const tribute = createForager(3);

    const { resolution } = selectAndResolveEvent({
      definition: BERRY_EVENT,

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      /*
       * 0.9 selects poisonous.
       * 0 fails identification.
       */
      randomValues: [0.9, 0],
    });

    expect(getAppliedStatusIds(resolution)).toEqual(["poisoned"]);

    expect(getAcquiredItemIds(resolution)).toEqual([]);
  });

  it("retains identified harmful forage at Brains 4", () => {
    const tribute = withAuthoringTestItem(createForager(4), "foraging-guidebook");

    const { resolution } = selectAndResolveEvent({
      definition: BERRY_EVENT,

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      randomValues: [0.6],
    });

    expect(getAcquiredItemIds(resolution)).toEqual(["hallucinogenic-berries"]);

    expect(getAppliedStatusIds(resolution)).toEqual([]);

    expect(resolution.changes).toContainEqual({
      type: "use-item",

      tributeId: tribute.id,

      itemInstanceId: tribute.inventory[0]?.id,

      reason: "test-berry-foraging",
    });
  });

  it("leaves identified harmful forage behind below Brains 4", () => {
    const tribute = withAuthoringTestItem(createForager(3), "foraging-guidebook");

    const { resolution } = selectAndResolveEvent({
      definition: BERRY_EVENT,

      state: createAuthoringTestGame([tribute]),

      livingTributes: [tribute],

      randomValues: [0.9],
    });

    expect(getAcquiredItemIds(resolution)).toEqual([]);

    expect(getAppliedStatusIds(resolution)).toEqual([]);

    expect(resolution.text).toContain("leaves them behind");
  });

  it("borrows and reserves a truce partner's guidebook", () => {
    const patient: GameTribute = {
      ...createForager(3),

      district: 1,
      districtPosition: 1,
    };

    let owner: GameTribute = {
      ...createAuthoringTestTribute({
        id: "guidebook-owner",

        name: "Peeta",

        stats: {
          brains: 1,
          brawn: 3,
          luck: 3,
        },
      }),

      district: 1,
      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "foraging-guidebook");

    const guidebook = owner.inventory[0];

    if (!guidebook) {
      throw new Error("Expected a guidebook fixture.");
    }

    const state: GameState = {
      ...createAuthoringTestGame([patient, owner]),

      truces: [
        createTruceInstance(
          "guidebook-truce",
          [patient.id, owner.id],

          AUTHORING_TEST_ROUND,

          {
            day: 3,
            period: "day",
          },
        ),
      ],
    };

    const { selection, resolution } = selectAndResolveEvent({
      definition: BERRY_EVENT,

      state,

      livingTributes: [patient, owner],

      selectionRandomValues: [0],

      /*
       * Select poisonous forage. No
       * identification roll should occur
       * because the guidebook guarantees it.
       */
      randomValues: [0.9, 0],
    });

    expect(selection.participantsByRole.tribute?.[0]?.id).toBe(patient.id);

    expect(selection.selectedItemInstanceIds).toEqual([guidebook.id]);

    expect(selection.itemsByRole.tribute?.[0]).toMatchObject({
      userTributeId: patient.id,

      owner: {
        id: owner.id,
      },

      item: {
        id: guidebook.id,

        definitionId: "foraging-guidebook",
      },
    });

    expect(getAppliedStatusIds(resolution)).toEqual([]);

    expect(getAcquiredItemIds(resolution)).toEqual([]);

    expect(resolution.changes).toContainEqual({
      type: "use-item",

      tributeId: owner.id,

      itemInstanceId: guidebook.id,

      reason: "test-berry-foraging",
    });

    expect(resolution.text).toContain("Peeta's foraging guidebook");
  });
});
