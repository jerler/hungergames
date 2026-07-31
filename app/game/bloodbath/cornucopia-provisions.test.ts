import { describe, expect, it } from "vitest";

import { sequenceBloodbathEvents } from "./bloodbath-sequencer";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import { createDefaultGameConfig } from "~/game/types/game-config";
import type { GameState, ResolvedEvent, RoundReference } from "~/game/types/game-state";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const satisfies RoundReference;

function createGame(): GameState {
  let nextId = 0;

  return createInitialGameState(
    {
      ...createDefaultGameConfig(),
      districtCount: 6,
    },
    createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5),
    "random",
    {
      createId: () => {
        nextId += 1;
        return `bloodbath-provisions-${nextId}`;
      },
      seed: "bloodbath-provisions",
      now: "2026-07-26T12:00:00.000Z",
    },
  );
}

function getEliminatedIds(event: ResolvedEvent): Set<string> {
  return new Set(
    event.changes.flatMap((change) =>
      change.type === "eliminate-tribute" ? [change.tributeId] : [],
    ),
  );
}

describe("Bloodbath Cornucopia provisions", () => {
  it("awards provisions once on each surviving first appearance and never to fleeing tributes", () => {
    const game = createGame();
    const events = sequenceBloodbathEvents(game, DAY_ONE);
    const cornucopiaEvents = events.filter((event) => event.feedGroup === "bloodbath-cornucopia");
    const fleeEvents = events.filter((event) => event.feedGroup === "bloodbath-flee");

    expect(cornucopiaEvents.length).toBeGreaterThan(0);
    expect(fleeEvents.length).toBeGreaterThan(0);

    const seenCornucopiaTributeIds = new Set<string>();
    const provisionCountByTributeId = new Map<string, number>();
    const provisionItemIds = new Set<string>();
    let survivingFirstAppearanceCount = 0;
    let fatalFirstAppearanceCount = 0;
    let repeatedAppearanceCount = 0;

    for (const event of cornucopiaEvents) {
      const eliminatedIds = getEliminatedIds(event);

      for (const change of event.changes) {
        if (
          change.type !== "acquire-item" ||
          change.item.definitionId !== "cornucopia-provisions"
        ) {
          continue;
        }

        expect(provisionItemIds.has(change.item.id)).toBe(false);
        provisionItemIds.add(change.item.id);
        provisionCountByTributeId.set(
          change.tributeId,
          (provisionCountByTributeId.get(change.tributeId) ?? 0) + 1,
        );
      }

      for (const tributeId of event.participantTributeIds) {
        const isFirstAppearance = !seenCornucopiaTributeIds.has(tributeId);
        const provisionAcquisitions = event.changes.filter(
          (change) =>
            change.type === "acquire-item" &&
            change.tributeId === tributeId &&
            change.item.definitionId === "cornucopia-provisions",
        );
        const satisfiedNeeds = event.changes.flatMap((change) =>
          change.type === "satisfy-survival-need" && change.tributeId === tributeId
            ? [change.need]
            : [],
        );

        if (!isFirstAppearance) {
          repeatedAppearanceCount += 1;
          expect(provisionAcquisitions).toEqual([]);
          expect(satisfiedNeeds).toEqual([]);
          expect(provisionCountByTributeId.get(tributeId)).toBe(1);
          continue;
        }

        seenCornucopiaTributeIds.add(tributeId);

        if (eliminatedIds.has(tributeId)) {
          fatalFirstAppearanceCount += 1;
          expect(provisionAcquisitions).toEqual([]);
          expect(satisfiedNeeds).toEqual([]);
          continue;
        }

        survivingFirstAppearanceCount += 1;
        expect(provisionAcquisitions).toHaveLength(1);
        expect(satisfiedNeeds).toEqual(expect.arrayContaining(["food", "water"]));
      }
    }

    expect(survivingFirstAppearanceCount).toBeGreaterThan(0);
    expect(fatalFirstAppearanceCount).toBeGreaterThan(0);
    expect(repeatedAppearanceCount).toBeGreaterThan(0);

    for (const count of provisionCountByTributeId.values()) {
      expect(count).toBe(1);
    }

    for (const event of fleeEvents) {
      expect(
        event.changes.some(
          (change) =>
            change.type === "acquire-item" && change.item.definitionId === "cornucopia-provisions",
        ),
      ).toBe(false);
    }
  });

  it("preserves seeded determinism", () => {
    const game = createGame();

    expect(sequenceBloodbathEvents(game, DAY_ONE)).toEqual(sequenceBloodbathEvents(game, DAY_ONE));
  });
});
