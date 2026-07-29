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
  it("awards every Cornucopia survivor and no fleeing tribute", () => {
    const game = createGame();
    const events = sequenceBloodbathEvents(game, DAY_ONE);

    const cornucopiaEvents = events.filter((event) => event.feedGroup === "bloodbath-cornucopia");
    const fleeEvents = events.filter((event) => event.feedGroup === "bloodbath-flee");

    expect(cornucopiaEvents.length).toBeGreaterThan(0);
    expect(fleeEvents.length).toBeGreaterThan(0);

    let survivorCount = 0;
    let deadEntrantCount = 0;
    const provisionItemIds = new Set<string>();

    for (const event of cornucopiaEvents) {
      const eliminatedIds = getEliminatedIds(event);
      const survivors = event.participantTributeIds.filter(
        (tributeId) => !eliminatedIds.has(tributeId),
      );

      if (survivors.length > 0) {
        expect(event.text).not.toMatch(/pack of food and water from the Cornucopia/i);
        expect(event.text).not.toMatch(/survivors each escape with a pack of food/i);
      }

      for (const tributeId of event.participantTributeIds) {
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

        if (eliminatedIds.has(tributeId)) {
          deadEntrantCount += 1;
          expect(provisionAcquisitions).toEqual([]);
          expect(satisfiedNeeds).not.toEqual(expect.arrayContaining(["food", "water"]));
          continue;
        }

        survivorCount += 1;
        expect(provisionAcquisitions).toHaveLength(1);
        expect(satisfiedNeeds).toEqual(expect.arrayContaining(["food", "water"]));

        const acquisition = provisionAcquisitions[0];

        if (acquisition?.type === "acquire-item") {
          expect(provisionItemIds.has(acquisition.item.id)).toBe(false);
          provisionItemIds.add(acquisition.item.id);
        }
      }
    }

    expect(survivorCount).toBeGreaterThan(0);
    expect(deadEntrantCount).toBeGreaterThan(0);

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
