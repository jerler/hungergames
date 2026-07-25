import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import { createStatusEffectInstance } from "~/game/statuses/status-engine";

import { createTruceInstance } from "~/game/truces/truce-engine";

import type { GameState, GameTribute } from "~/game/types/game-state";

import { prepareRound, type PreparedRound } from "./round-preparation";

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

function getCamouflageEvents(prepared: PreparedRound) {
  return prepared.events.filter(
    (event) => event.preparation?.mechanic === "camouflage-preparation",
  );
}

describe("round camouflage preparation", () => {
  it("emits a visible camouflage preparation event", () => {
    let tribute = createAuthoringTestTribute({
      id: "visible-camouflage",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const net = tribute.inventory[0];

    if (!net) {
      throw new Error("Expected a camouflage-net fixture.");
    }

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      DAY_TWO,
    );

    const events = getCamouflageEvents(prepared);

    expect(events).toHaveLength(1);

    expect(events[0]).toMatchObject({
      definitionId: "automatic-camouflage-preparation",

      kind: "preparation",

      preparation: {
        mechanic: "camouflage-preparation",

        actingTributeId: tribute.id,

        itemDefinitionId: "camouflage-net",

        itemInstanceId: net.id,

        itemOwnerTributeId: tribute.id,

        usesRemainingAfter: null,
      },
    });

    expect(prepared.committedItemInstanceIds).toContain(net.id);
  });

  it("keeps a reusable camouflage net in inventory", () => {
    let tribute = createAuthoringTestTribute({
      id: "reusable-net",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    const net = tribute.inventory[0];

    if (!net) {
      throw new Error("Expected a camouflage-net fixture.");
    }

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      DAY_TWO,
    );

    const preparedTribute = prepared.state.tributes.find(
      (candidate) => candidate.id === tribute.id,
    );

    expect(preparedTribute?.inventory).toContainEqual(net);

    expect(getCamouflageEvents(prepared)[0]?.changes).toContainEqual({
      type: "use-item",

      tributeId: tribute.id,

      itemInstanceId: net.id,

      reason: ["preparation", "day", DAY_TWO.day, "camouflage-preparation", tribute.id].join(":"),
    });
  });

  it("removes consumed camouflage paint from inventory", () => {
    let tribute = createAuthoringTestTribute({
      id: "single-use-paint",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-paint");

    const paint = tribute.inventory[0];

    if (!paint) {
      throw new Error("Expected a camouflage-paint fixture.");
    }

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      DAY_TWO,
    );

    const event = getCamouflageEvents(prepared)[0];

    expect(event?.preparation).toMatchObject({
      itemDefinitionId: "camouflage-paint",

      itemInstanceId: paint.id,

      usesRemainingAfter: 0,
    });

    expect(event?.changes).toContainEqual({
      type: "consume-item",

      tributeId: tribute.id,

      itemInstanceId: paint.id,

      uses: 1,

      reason: ["preparation", "day", DAY_TWO.day, "camouflage-preparation", tribute.id].join(":"),
    });

    expect(
      prepared.state.tributes.find((candidate) => candidate.id === tribute.id)?.inventory,
    ).toEqual([]);
  });

  it("attributes borrowed camouflage to its physical owner", () => {
    const borrower: GameTribute = {
      ...createAuthoringTestTribute({
        id: "round-borrower",
        name: "Katniss",
      }),

      district: 1,

      districtPosition: 1,
    };

    let owner: GameTribute = {
      ...createAuthoringTestTribute({
        id: "round-owner",
        name: "Peeta",
      }),

      district: 1,

      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "camouflage-net");

    const net = owner.inventory[0];

    if (!net) {
      throw new Error("Expected a borrowed camouflage-net fixture.");
    }

    const state: GameState = {
      ...createAuthoringTestGame([borrower, owner]),

      truces: [
        createTruceInstance(
          "round-camouflage-truce",

          [borrower.id, owner.id],

          DAY_TWO,

          {
            day: 3,
            period: "day",
          },
        ),
      ],
    };

    const prepared = prepareRound(state, DAY_TWO);

    const event = getCamouflageEvents(prepared)[0];

    expect(event?.preparation).toMatchObject({
      actingTributeId: borrower.id,

      itemDefinitionId: "camouflage-net",

      itemInstanceId: net.id,

      itemOwnerTributeId: owner.id,
    });

    expect(event?.participantTributeIds).toEqual([borrower.id, owner.id]);

    expect(event?.text).toContain("Peeta's camouflage net");

    expect(event?.changes).toContainEqual(
      expect.objectContaining({
        type: "use-item",

        tributeId: owner.id,

        itemInstanceId: net.id,
      }),
    );
  });

  it("reserves one shared net for only one tribute", () => {
    const first: GameTribute = {
      ...createAuthoringTestTribute({
        id: "first-camouflage-user",
      }),

      district: 1,

      districtPosition: 1,
    };

    let owner: GameTribute = {
      ...createAuthoringTestTribute({
        id: "shared-net-owner",
      }),

      district: 1,

      districtPosition: 2,
    };

    owner = withAuthoringTestItem(owner, "camouflage-net");

    const net = owner.inventory[0];

    if (!net) {
      throw new Error("Expected a shared camouflage-net fixture.");
    }

    const state: GameState = {
      ...createAuthoringTestGame([first, owner]),

      truces: [
        createTruceInstance(
          "shared-net-truce",

          [first.id, owner.id],

          DAY_TWO,

          {
            day: 3,
            period: "day",
          },
        ),
      ],
    };

    const prepared = prepareRound(state, DAY_TWO);

    const events = getCamouflageEvents(prepared);

    expect(events).toHaveLength(1);

    expect(events[0]?.preparation).toMatchObject({
      actingTributeId: first.id,

      itemOwnerTributeId: owner.id,

      itemInstanceId: net.id,
    });

    expect(prepared.committedItemInstanceIds).toEqual(new Set([net.id]));
  });

  it("does not prepare an already-hidden tribute", () => {
    let tribute = createAuthoringTestTribute({
      id: "hidden-before-preparation",
    });

    tribute = withAuthoringTestItem(tribute, "camouflage-net");

    tribute = {
      ...tribute,

      statuses: [createStatusEffectInstance("already-hidden", tribute.id, "hidden", 1, DAY_TWO)],
    };

    const prepared = prepareRound(
      createAuthoringTestGame([tribute]),

      DAY_TWO,
    );

    expect(getCamouflageEvents(prepared)).toEqual([]);

    expect(prepared.committedItemInstanceIds.size).toBe(0);
  });
});
