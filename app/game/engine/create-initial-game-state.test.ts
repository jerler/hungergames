import { describe, expect, it } from "vitest";

import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";

import { createInitialGameState } from "./create-initial-game-state";

describe("createInitialGameState", () => {
  it("creates living Game-tribute snapshots", () => {
    const config = {
      ...createDefaultGameConfig(),
      districtCount: 6 as const,
    };

    const drafts = createRandomTributeDrafts(6);

    let nextId = 0;

    const gameState = createInitialGameState(config, drafts, "random", {
      createId: () => {
        nextId += 1;
        return `id-${nextId}`;
      },
      now: "2026-07-18T12:00:00.000Z",
      seed: "test-seed",
    });

    expect(gameState.id).toBe("id-1");
    expect(gameState.seed).toBe("test-seed");
    expect(gameState.phase).toBe("opening");
    expect(gameState.tributes).toHaveLength(12);

    expect(gameState.tributes.every((tribute) => tribute.isAlive && tribute.death === null)).toBe(
      true,
    );

    expect(gameState.tributes[0]).toMatchObject({
      id: "id-2",
      district: 1,
      districtPosition: 1,
      statistics: {
        kills: 0,
        attemptedKills: 0,
        giftsReceived: 0,
        eventsSurvived: 0,
      },
    });
  });

  it("rejects an incomplete roster", () => {
    const config = {
      ...createDefaultGameConfig(),
      districtCount: 6 as const,
    };

    expect(() => createInitialGameState(config, [], "manual")).toThrow(
      "A Game cannot begin with an invalid tribute roster.",
    );
  });
});
