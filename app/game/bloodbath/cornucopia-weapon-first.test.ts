import { describe, expect, it } from "vitest";

import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { sequenceBloodbathEvents } from "./bloodbath-sequencer";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

function createGame(seed: string) {
  let nextId = 0;

  return createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => `${seed}-id-${++nextId}`,
      seed,
      now: "2026-07-29T12:00:00.000Z",
    },
  );
}

describe("weapon-first Cornucopia acquisitions", () => {
  it("keeps supplies rare and secondary to an offensive item", () => {
    let offensiveCount = 0;
    let supplyCount = 0;

    for (let index = 0; index < 250; index += 1) {
      const events = sequenceBloodbathEvents(createGame(`weapon-first-${index}`), DAY_ONE);

      for (const event of events) {
        const byTribute = new Map<string, ItemDefinitionId[]>();

        for (const change of event.changes) {
          if (
            change.type !== "acquire-item" ||
            change.item.definitionId === "cornucopia-provisions"
          ) {
            continue;
          }

          byTribute.set(change.tributeId, [
            ...(byTribute.get(change.tributeId) ?? []),
            change.item.definitionId,
          ]);
        }

        for (const [tributeId, itemIds] of byTribute) {
          const offensive = itemIds.filter((itemId) => Boolean(getItemDefinition(itemId).offense));
          const supplies = itemIds.filter((itemId) => !getItemDefinition(itemId).offense);

          offensiveCount += offensive.length;
          supplyCount += supplies.length;

          if (supplies.length > 0) {
            expect(
              offensive.length,
              `${event.id} gave ${tributeId} supplies without a weapon.`,
            ).toBeGreaterThan(0);
          }
        }
      }
    }

    expect(offensiveCount).toBeGreaterThan(0);
    expect(supplyCount).toBeGreaterThan(0);
    expect(supplyCount / offensiveCount).toBeLessThan(0.15);
  }, 20_000);
});
