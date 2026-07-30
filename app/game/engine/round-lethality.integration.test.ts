import { describe, expect, it } from "vitest";

import { getRoundLethalityProfile, isBloodbathRound } from "~/game/engine/round-lethality";
import { simulateGameBatch } from "~/game/simulation/simulation-runner";

function roundKey(day: number, period: "day" | "night"): string {
  return `${day}:${period}`;
}

describe("ordinary-round lethality integration", () => {
  it("never exceeds the configured kill cap across complete games", () => {
    const runs = simulateGameBatch([
      {
        seedPrefix: "lethality-full-game",
        count: 30,
        districtCount: 12,
      },
      {
        seedPrefix: "lethality-half-game",
        count: 40,
        districtCount: 6,
      },
    ]);

    for (const run of runs) {
      const livingCountByRound = new Map(
        run.roundSnapshots.map(({ round, state }) => [
          roundKey(round.day, round.period),
          state.tributes.filter((tribute) => tribute.isAlive).length,
        ]),
      );

      const eventsByRound = new Map<string, typeof run.state.eventHistory>();

      for (const event of run.state.eventHistory) {
        const key = roundKey(event.round.day, event.round.period);
        eventsByRound.set(key, [...(eventsByRound.get(key) ?? []), event]);
      }

      for (const [key, events] of eventsByRound) {
        const [dayText, periodText] = key.split(":");
        const round = {
          day: Number(dayText),
          period: periodText === "day" ? "day" : "night",
        } as const;

        if (isBloodbathRound(round)) {
          continue;
        }

        const livingCount = livingCountByRound.get(key);

        if (livingCount === undefined) {
          throw new Error(`Simulation "${run.seed}" has no starting snapshot for ${key}.`);
        }

        const eliminatedTributeIds = new Set(
          events.flatMap((event) =>
            event.changes.flatMap((change) =>
              change.type === "eliminate-tribute" ? [change.tributeId] : [],
            ),
          ),
        );

        const profile = getRoundLethalityProfile(round, livingCount);

        expect(
          eliminatedTributeIds.size,
          `${run.seed} exceeded the ${key} elimination cap.`,
        ).toBeLessThanOrEqual(profile.maxEliminations);
      }
    }
  }, 30_000);
});
