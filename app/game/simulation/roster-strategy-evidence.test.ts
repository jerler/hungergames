import { describe, expect, it } from "vitest";

import { always, createEvent, minimumStat, result } from "~/game/events/authoring";
import { getEventAuditPrerequisiteEvidence } from "~/game/events/event-audit-prerequisites";
import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import { createSeededRandom } from "~/game/engine/random";
import {
  AUDIT_STAT_VALUES,
  AUDIT_TRIBUTE_STATS,
  collectRosterStrategyEvidence,
  getMissingStatPrerequisiteMetadataDefinitionIds,
  getSimulationInitialState,
  replayBloodbathStrategyAssignments,
} from "~/game/simulation/roster-strategy-evidence";
import { simulateGame } from "~/game/simulation/simulation-runner";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import type { DistrictCount } from "~/game/types/game-config";
import type { TributeDraft, TributeStatValue } from "~/game/types/tribute";

function findDefinition(definitionId: string) {
  return [...BLOODBATH_EVENT_CATALOGUE_FAMILIES, ...ORDINARY_EVENT_CATALOGUE_FAMILIES]
    .flatMap((family) => family.events)
    .find((definition) => definition.id === definitionId);
}

function statDistribution(
  drafts: readonly TributeDraft[],
  stat: "brains" | "brawn" | "luck",
): Record<TributeStatValue, number> {
  const counts: Record<TributeStatValue, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const draft of drafts) {
    counts[draft.stats[stat]] += 1;
  }

  return counts;
}

function createSeedGroupDistribution({
  seedPrefix,
  districtCount,
  games,
}: {
  seedPrefix: string;
  districtCount: DistrictCount;
  games: number;
}): Record<"brains" | "brawn" | "luck", Record<TributeStatValue, number>> {
  const totals = {
    brains: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    brawn: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    luck: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  } satisfies Record<"brains" | "brawn" | "luck", Record<TributeStatValue, number>>;

  for (let index = 0; index < games; index += 1) {
    const seed = `${seedPrefix}-${index}`;
    const drafts = createRandomTributeDrafts(
      districtCount,
      DEFAULT_TRIBUTES,
      createSeededRandom(`${seed}:reaping`),
    );

    for (const stat of AUDIT_TRIBUTE_STATS) {
      const counts = statDistribution(drafts, stat);

      for (const value of AUDIT_STAT_VALUES) {
        totals[stat][value] += counts[value];
      }
    }
  }

  return totals;
}

function totalVariationDistance(
  first: Record<TributeStatValue, number>,
  second: Record<TributeStatValue, number>,
): number {
  const firstTotal = AUDIT_STAT_VALUES.reduce((total, value) => total + first[value], 0);
  const secondTotal = AUDIT_STAT_VALUES.reduce((total, value) => total + second[value], 0);

  return (
    AUDIT_STAT_VALUES.reduce(
      (total, value) => total + Math.abs(first[value] / firstTotal - second[value] / secondTotal),
      0,
    ) / 2
  );
}

describe("Phase 2 roster and Bloodbath strategy evidence", () => {
  it("preserves declarative authored stat thresholds as effective-stat audit metadata", () => {
    const definition = createEvent("phase-2-authored-stat-proof")
      .solo("actor")
      .when(minimumStat("actor", "luck", 4))
      .category("survival")
      .tags("survival")
      .during("day")
      .resolve(
        always(
          result({
            text: "A test event occurs.",
            effects: [],
          }),
        ),
      );

    expect(definition.roles[0]?.auditEligibility).toEqual({
      coverage: "complete",
      prerequisites: [
        {
          kind: "stat",
          roleId: "actor",
          stat: "luck",
          comparison: "gte",
          threshold: 4,
          valueSource: "effective",
        },
      ],
    });
  });

  it("has typed stat prerequisite metadata for every active stat-gated definition", () => {
    expect(getMissingStatPrerequisiteMetadataDefinitionIds()).toEqual([]);
  });

  it("preserves authored OR stat gates as alternatives rather than false conjunctions", () => {
    const cringe = findDefinition("mixed-stat-cringe");
    const warningShot = findDefinition("low-brains-warning-shot");

    expect(cringe).toBeDefined();
    expect(warningShot).toBeDefined();

    expect(cringe ? getEventAuditPrerequisiteEvidence(cringe).prerequisites : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "stat-any",
          roleId: "actor",
          alternatives: expect.arrayContaining([
            expect.objectContaining({
              stat: "brawn",
              comparison: "lte",
              threshold: 2,
            }),
            expect.objectContaining({
              stat: "luck",
              comparison: "lte",
              threshold: 2,
            }),
          ]),
        }),
      ]),
    );

    expect(warningShot ? getEventAuditPrerequisiteEvidence(warningShot).prerequisites : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "stat-any",
          roleId: "actor",
          alternatives: expect.arrayContaining([
            expect.objectContaining({
              stat: "brains",
              comparison: "eq",
              threshold: 1,
            }),
            expect.objectContaining({
              stat: "luck",
              comparison: "eq",
              threshold: 1,
            }),
          ]),
        }),
      ]),
    );
  });

  it("uses shuffled DEFAULT_TRIBUTES identities and exact stats in real simulations", () => {
    const defaultById = new Map(
      DEFAULT_TRIBUTES.map((definition) => [definition.id, definition] as const),
    );

    for (const districtCount of [6, 12] as const) {
      const run = simulateGame({
        seed: `phase-2-real-default-roster-${districtCount}`,
        districtCount,
      });
      const roster = getSimulationInitialState(run).tributes;
      const distinctStatVectors = new Set<string>();

      expect(roster).toHaveLength(districtCount * 2);
      expect(new Set(roster.map((tribute) => tribute.sourceDefinitionId)).size).toBe(roster.length);

      for (const tribute of roster) {
        expect(tribute.sourceDefinitionId).not.toBeNull();

        const definition = defaultById.get(tribute.sourceDefinitionId ?? "");

        expect(definition).toBeDefined();
        expect(tribute.snapshot.stats).toEqual(definition?.stats);
        distinctStatVectors.add(JSON.stringify(tribute.snapshot.stats));
      }

      expect(distinctStatVectors.size).toBeGreaterThan(1);
    }
  });

  it("replays the exact production Bloodbath strategy assignments", () => {
    const run = simulateGame({
      seed: "phase-2-strategy-replay",
      districtCount: 6,
    });
    const assignments = replayBloodbathStrategyAssignments(run);
    const dayOneBloodbathEvents = run.state.eventHistory.filter(
      (event) =>
        event.round.day === 1 &&
        event.round.period === "day" &&
        event.kind === "primary" &&
        event.feedGroup !== undefined,
    );

    expect(assignments).toHaveLength(12);

    for (const assignment of assignments) {
      const firstEvent = dayOneBloodbathEvents.find((event) =>
        event.participantTributeIds.includes(assignment.tributeId),
      );

      expect(firstEvent).toBeDefined();
      expect(firstEvent?.feedGroup).toBe(
        assignment.strategy === "cornucopia" ? "bloodbath-cornucopia" : "bloodbath-flee",
      );
    }
  });

  it("produces plausible and similar roster distributions across three deterministic seed groups", () => {
    const seedPrefixes = [
      "phase-2-roster-group-alpha",
      "phase-2-roster-group-beta",
      "phase-2-roster-group-gamma",
    ] as const;

    for (const districtCount of [6, 12] as const) {
      const groups = seedPrefixes.map((seedPrefix) =>
        createSeedGroupDistribution({
          seedPrefix,
          districtCount,
          games: 20,
        }),
      );
      const expectedTributes = districtCount * 2 * 20;

      for (const group of groups) {
        for (const stat of AUDIT_TRIBUTE_STATS) {
          const total = AUDIT_STAT_VALUES.reduce((sum, value) => sum + group[stat][value], 0);
          const mean =
            AUDIT_STAT_VALUES.reduce((sum, value) => sum + value * group[stat][value], 0) / total;

          expect(total).toBe(expectedTributes);
          expect(mean).toBeGreaterThan(2);
          expect(mean).toBeLessThan(4);
        }
      }

      for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
          for (const stat of AUDIT_TRIBUTE_STATS) {
            expect(
              totalVariationDistance(groups[firstIndex]![stat], groups[secondIndex]![stat]),
            ).toBeLessThan(0.2);
          }
        }
      }
    }
  });

  it("records focused outlier gates and selected participant stat evidence", () => {
    const runs = [
      simulateGame({
        seed: "phase-2-evidence-half",
        districtCount: 6,
        captureSelectionDiagnostics: true,
      }),
      simulateGame({
        seed: "phase-2-evidence-full",
        districtCount: 12,
        captureSelectionDiagnostics: true,
      }),
    ];
    const report = collectRosterStrategyEvidence(runs);

    expect(report.focusedDefinitions).toHaveLength(4);

    expect(
      report.focusedDefinitions.filter(
        (metric) => metric.definitionId === "cornucopia-high-brains-decision-paralysis",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleId: "actor",
          stat: "brains",
          comparison: "gte",
          authoredThreshold: 4,
          valueSource: "base",
        }),
      ]),
    );

    expect(
      report.focusedDefinitions.filter(
        (metric) => metric.definitionId === "cornucopia-low-brains-not-a-box",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleId: "actor",
          stat: "brains",
          comparison: "eq",
          authoredThreshold: 1,
          valueSource: "base",
        }),
      ]),
    );

    expect(report.statGatedSelections.every((row) => row.satisfiesAuthoredThreshold)).toBe(true);

    for (const summary of report.gameSizeSummaries) {
      for (const stat of AUDIT_TRIBUTE_STATS) {
        const averageCount = AUDIT_STAT_VALUES.reduce(
          (total, value) => total + summary.averageRosterStatCounts[stat][value],
          0,
        );

        expect(averageCount).toBeCloseTo(summary.tributeCountPerGame, 8);
      }
    }
  });
});
