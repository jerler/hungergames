import { describe, expect, it } from "vitest";

import type {
  EventFeedGroup,
  ResolvedEvent,
  ResolvedEventKind,
  RoundReference,
} from "~/game/types/game-state";

import {
  collectEventDistributionMetrics,
  type EventDistributionGameSizeId,
} from "./event-distribution-metrics";

import { createEventDistributionReport } from "./event-distribution-report";

import type { SimulationRun } from "./simulation-runner";

function createResolvedEvent({
  definitionId,
  round,
  participantCount,
  feedGroup,
  kind = "primary",
  eliminations = 0,
}: {
  definitionId: string;
  round: RoundReference;
  participantCount: number;
  feedGroup?: EventFeedGroup;
  kind?: ResolvedEventKind;
  eliminations?: number;
}): ResolvedEvent {
  const participantTributeIds = Array.from(
    {
      length: participantCount,
    },
    (_, index) => `${definitionId}-tribute-${index}`,
  );

  return {
    id: `${definitionId}-resolved`,
    definitionId,
    kind,
    resolutionMode: "standard",
    feedGroup,
    round,
    participantTributeIds,
    text: definitionId,
    changes: Array.from(
      {
        length: eliminations,
      },
      (_, index) => ({
        type: "eliminate-tribute" as const,
        tributeId: participantTributeIds[index] ?? `${definitionId}-eliminated-${index}`,
        causeId: definitionId,
        causeLabel: definitionId,
        summary: definitionId,
        killerTributeIds: [],
      }),
    ),
  };
}

function createRun({
  seed,
  gameSize,
  events,
}: {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  events: readonly ResolvedEvent[];
}): SimulationRun {
  return {
    seed,
    districtCount: gameSize === "half-game" ? 6 : 12,
    roundsCompleted: 2,
    roundSnapshots: [],
    state: {
      eventHistory: [...events],
    } as SimulationRun["state"],
  };
}

describe("event distribution report", () => {
  it("collects pool, shape, fatality, and overlap metrics", () => {
    const cornucopiaDefinitionId = "test-cornucopia-trio";
    const metrics = collectEventDistributionMetrics([
      createRun({
        seed: "half-0",
        gameSize: "half-game",
        events: [
          createResolvedEvent({
            definitionId: cornucopiaDefinitionId,
            round: {
              day: 1,
              period: "day",
            },
            participantCount: 3,
            feedGroup: "bloodbath-cornucopia",
            eliminations: 1,
          }),
          createResolvedEvent({
            definitionId: "test-flee-solo",
            round: {
              day: 1,
              period: "day",
            },
            participantCount: 1,
            feedGroup: "bloodbath-flee",
          }),
          createResolvedEvent({
            definitionId: "test-later-day-pair",
            round: {
              day: 2,
              period: "day",
            },
            participantCount: 2,
          }),
          createResolvedEvent({
            definitionId: "test-night-group",
            round: {
              day: 1,
              period: "night",
            },
            participantCount: 4,
          }),
          createResolvedEvent({
            definitionId: "test-preparation",
            round: {
              day: 1,
              period: "night",
            },
            participantCount: 1,
            kind: "preparation",
          }),
          createResolvedEvent({
            definitionId: "test-unclassified-day-one",
            round: {
              day: 1,
              period: "day",
            },
            participantCount: 1,
          }),
        ],
      }),
      createRun({
        seed: "half-1",
        gameSize: "half-game",
        events: [
          createResolvedEvent({
            definitionId: cornucopiaDefinitionId,
            round: {
              day: 1,
              period: "day",
            },
            participantCount: 2,
            feedGroup: "bloodbath-cornucopia",
          }),
        ],
      }),
      createRun({
        seed: "full-0",
        gameSize: "full-game",
        events: [
          createResolvedEvent({
            definitionId: "test-full-cornucopia",
            round: {
              day: 1,
              period: "day",
            },
            participantCount: 4,
            feedGroup: "bloodbath-cornucopia",
          }),
        ],
      }),
    ]);

    expect(metrics.sample).toEqual({
      totalGames: 3,
      halfGames: 2,
      fullGames: 1,
    });

    expect(metrics.excludedHistoryEntries).toEqual({
      nonPrimary: 1,
      unclassifiedPrimary: 1,
      unclassifiedPrimaryDefinitionIds: ["test-unclassified-day-one"],
    });

    const halfCornucopia = metrics.gameSizes["half-game"].pools["bloodbath-cornucopia"];

    expect(halfCornucopia.totalSelections).toBe(2);
    expect(halfCornucopia.participantShapes.trio.selections).toBe(1);
    expect(halfCornucopia.participantShapes.pair.selections).toBe(1);
    expect(halfCornucopia.nonSoloShare).toBe(1);
    expect(halfCornucopia.consecutiveGameOverlap).toMatchObject({
      comparisons: 1,
      average: 1,
      median: 1,
      percentile90: 1,
      maximum: 1,
    });

    expect(halfCornucopia.events[0]).toMatchObject({
      definitionId: cornucopiaDefinitionId,
      selections: 2,
      gamesWithEvent: 2,
      appearanceRate: 1,
      fatalSelections: 1,
      eliminations: 1,
    });
  });

  it("formats deterministic Markdown with every report pool", () => {
    const metrics = collectEventDistributionMetrics([
      createRun({
        seed: "report-half",
        gameSize: "half-game",
        events: [
          createResolvedEvent({
            definitionId: "report-cornucopia",
            round: {
              day: 1,
              period: "day",
            },
            participantCount: 3,
            feedGroup: "bloodbath-cornucopia",
          }),
        ],
      }),
      createRun({
        seed: "report-full",
        gameSize: "full-game",
        events: [
          createResolvedEvent({
            definitionId: "report-night",
            round: {
              day: 1,
              period: "night",
            },
            participantCount: 2,
          }),
        ],
      }),
    ]);

    const firstReport = createEventDistributionReport(metrics);
    const secondReport = createEventDistributionReport(metrics);

    expect(secondReport).toBe(firstReport);
    expect(firstReport).toContain("# Event Distribution Baseline");
    expect(firstReport).toContain("## Half Game");
    expect(firstReport).toContain("## Full Game");
    expect(firstReport).toContain("### Bloodbath — Cornucopia");
    expect(firstReport).toContain("### Bloodbath — Fleeing");
    expect(firstReport).toContain("### Day 2+");
    expect(firstReport).toContain("### Night");
    expect(firstReport).toContain("#### Participant shape");
    expect(firstReport).toContain("#### Never selected");
  });
});
