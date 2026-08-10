import { describe, expect, it } from "vitest";

import {
  collectPrerequisiteLifecycleEvidence,
  createItemLifecycleByGameTsv,
  createItemPrerequisiteAvailabilityTsv,
  createPrerequisiteLifecycleEvidenceMarkdown,
  createStatusLifecycleByGameTsv,
  createStatusPreparationRemovalTsv,
  createStatusPrerequisiteAvailabilityTsv,
  createTruceLifecycleTsv,
  createTrucePrerequisiteAvailabilityTsv,
} from "~/game/simulation/prerequisite-lifecycle-evidence";
import { simulateGame } from "~/game/simulation/simulation-runner";

describe("Phase 3 prerequisite lifecycle evidence", () => {
  const runs = [
    simulateGame({
      seed: "phase-3-prerequisite-half-a",
      districtCount: 6,
      captureSelectionDiagnostics: true,
    }),
    simulateGame({
      seed: "phase-3-prerequisite-half-b",
      districtCount: 6,
      captureSelectionDiagnostics: true,
    }),
    simulateGame({
      seed: "phase-3-prerequisite-full-a",
      districtCount: 12,
      captureSelectionDiagnostics: true,
    }),
    simulateGame({
      seed: "phase-3-prerequisite-full-b",
      districtCount: 12,
      captureSelectionDiagnostics: true,
    }),
  ];
  const report = collectPrerequisiteLifecycleEvidence(runs);

  it("reconciles item, status, and truce lifecycle evidence against simulation history", () => {
    expect(report.reconciliation).toEqual({
      passed: true,
      failures: [],
    });

    expect(report.gameSizeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gameSize: "half-game",
          games: 2,
        }),
        expect.objectContaining({
          gameSize: "full-game",
          games: 2,
        }),
      ]),
    );

    for (const summary of report.gameSizeSummaries) {
      expect(summary.itemAcquisitions).toBeGreaterThan(0);
      expect(summary.statusApplications).toBeGreaterThan(0);
      expect(summary.truceFormations).toBeGreaterThanOrEqual(
        summary.truceBreakups + summary.trucesActiveAtGameEnd,
      );
    }
  });

  it("records item lineage, ownership exposure, and exact typed prerequisite availability", () => {
    expect(report.itemLifecycleByGame.length).toBeGreaterThan(0);
    expect(report.itemPrerequisites.length).toBeGreaterThan(0);

    for (const row of report.itemLifecycleByGame) {
      expect(row.acquiredInstances).toBeGreaterThan(0);
      expect(row.retainedInstances).toBeLessThanOrEqual(row.acquiredInstances);
      expect(row.ownedPreparedRoundExposures).toBeGreaterThanOrEqual(0);
      expect(row.truceAccessiblePreparedRoundExposures).toBeGreaterThanOrEqual(0);
    }

    expect(
      report.itemPrerequisites.some(
        (row) => row.prerequisiteKind === "item-definition" || row.prerequisiteKind === "item-tag",
      ),
    ).toBe(true);

    for (const row of report.itemPrerequisites) {
      expect(row.opportunities).toBeGreaterThan(0);
      expect(row.stateAvailableOpportunities).toBeLessThanOrEqual(row.opportunities);
      expect(row.hardFeasibleOpportunities).toBeLessThanOrEqual(row.opportunities);
      expect(row.opportunityFeasibleOpportunities).toBeLessThanOrEqual(row.opportunities);
      expect(row.stateAvailabilityRate).toBeGreaterThanOrEqual(0);
      expect(row.stateAvailabilityRate).toBeLessThanOrEqual(1);
    }
  });

  it("records status persistence, preparation removals, and selector-visible prerequisite windows", () => {
    expect(report.statusLifecycleByGame.length).toBeGreaterThan(0);
    expect(report.statusPrerequisites.length).toBeGreaterThan(0);

    for (const row of report.statusLifecycleByGame) {
      expect(row.creations).toBeGreaterThanOrEqual(0);
      expect(row.severityChanges).toBeGreaterThanOrEqual(0);
      expect(row.removals).toBeGreaterThanOrEqual(0);
      expect(row.preparedSelectorRoundExposures).toBeGreaterThanOrEqual(0);
      expect(row.retainedAtGameEnd).toBeGreaterThanOrEqual(0);
    }

    for (const row of report.statusPrerequisites) {
      expect(row.opportunities).toBeGreaterThan(0);
      expect(row.stateAvailableOpportunities).toBeLessThanOrEqual(row.opportunities);
      expect(row.stateAvailabilityRate).toBeGreaterThanOrEqual(0);
      expect(row.stateAvailabilityRate).toBeLessThanOrEqual(1);
    }

    for (const removal of report.statusPreparationRemovals) {
      expect(removal.preparationDefinitionId).not.toBe("");
      expect(removal.preparationMechanic).not.toBe("");
      expect(removal.dependentSelectorOpportunities).toBeGreaterThanOrEqual(0);
    }
  });

  it("records truce formation, lifetime, breakup reason, and typed compatible-truce availability", () => {
    expect(report.trucePrerequisites.length).toBeGreaterThan(0);

    for (const row of report.truceLifecycles) {
      expect(row.size).toBeGreaterThanOrEqual(2);
      expect(row.createdRoundSequence).toBeGreaterThan(0);
      expect(row.durationRoundSequenceSteps).toBeGreaterThanOrEqual(0);
      expect(row.activeAtGameEnd || row.breakupReason !== null).toBe(true);

      if (row.breakupReason !== null) {
        expect(row.breakupRoundSequence).not.toBeNull();
        expect(row.breakupEventId).not.toBeNull();
        expect(row.breakupDefinitionId).not.toBeNull();
      }
    }

    for (const row of report.trucePrerequisites) {
      expect(row.opportunities).toBeGreaterThan(0);
      expect(row.compatibleTruceTotal).toBeGreaterThanOrEqual(0);
      expect(row.matchingCandidateTotal).toBeGreaterThanOrEqual(0);
      expect(row.stateAvailableOpportunities).toBeLessThanOrEqual(row.opportunities);
    }
  });

  it("renders every Phase 3 report artifact deterministically", () => {
    const markdown = createPrerequisiteLifecycleEvidenceMarkdown(report);

    expect(markdown.join("\n")).toContain("Item, status, and truce prerequisite evidence");
    expect(markdown.join("\n")).toContain("Reconciliation: passed");

    const outputs = [
      createItemLifecycleByGameTsv(report),
      createItemPrerequisiteAvailabilityTsv(report),
      createStatusLifecycleByGameTsv(report),
      createStatusPrerequisiteAvailabilityTsv(report),
      createStatusPreparationRemovalTsv(report),
      createTruceLifecycleTsv(report),
      createTrucePrerequisiteAvailabilityTsv(report),
    ];

    for (const output of outputs) {
      expect(output.endsWith("\n")).toBe(true);
      expect(output.split("\n")[0]).toContain("\t");
    }
  });
});
