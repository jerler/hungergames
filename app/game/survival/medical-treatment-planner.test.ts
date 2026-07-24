import { describe, expect, it } from "vitest";

import {
  createAuthoringTestGame,
  createAuthoringTestTribute,
  withAuthoringTestItem,
} from "~/game/events/authoring/testing/authoring-test-fixtures";

import { createStatusEffectInstance } from "~/game/statuses/status-engine";

import { createTruceInstance } from "~/game/truces/truce-engine";

import type { GameState, GameTribute } from "~/game/types/game-state";

import { findMedicalTreatmentPlan, isBroadMedicalTreatment } from "./medical-treatment-planner";

const ROUND = {
  day: 2,
  period: "day",
} as const;

type TestMedicalStatusId = "injured" | "bleeding" | "poisoned" | "burned";

interface MedicalStatusOptions {
  severity?: 1 | 2 | 3;
  remainingRounds?: number;
}

function withMedicalStatus(
  tribute: GameTribute,
  statusId: TestMedicalStatusId,
  { severity = 1, remainingRounds }: MedicalStatusOptions = {},
): GameTribute {
  return {
    ...tribute,

    statuses: [
      ...tribute.statuses,

      createStatusEffectInstance(
        ["medical-status", tribute.id, statusId, tribute.statuses.length].join(":"),

        tribute.id,
        statusId,
        severity,
        ROUND,
        remainingRounds,
      ),
    ],
  };
}

function positionTribute(tribute: GameTribute, districtPosition: 1 | 2): GameTribute {
  return {
    ...tribute,
    district: 1,
    districtPosition,
  };
}

function createSharedGame(patient: GameTribute, partner: GameTribute): GameState {
  return {
    ...createAuthoringTestGame([patient, partner]),

    truces: [
      createTruceInstance("medical-planner-truce", [patient.id, partner.id], ROUND, {
        day: 3,
        period: "day",
      }),
    ],
  };
}

describe("medical treatment planner", () => {
  it("prioritizes an imminent fatal condition", () => {
    let patient = createAuthoringTestTribute({
      id: "urgent-patient",
    });

    patient = withMedicalStatus(patient, "injured", {
      severity: 3,
    });

    patient = withMedicalStatus(patient, "poisoned", {
      remainingRounds: 1,
    });

    patient = withAuthoringTestItem(patient, "painkillers");

    patient = withAuthoringTestItem(patient, "antidote");

    const plan = findMedicalTreatmentPlan(createAuthoringTestGame([patient]), patient);

    expect(plan?.targetStatus.definitionId).toBe("poisoned");

    expect(plan?.selection.item.definitionId).toBe("antidote");
  });

  it("prefers borrowed specific medicine over an owned med kit", () => {
    let patient = positionTribute(
      createAuthoringTestTribute({
        id: "patient",
      }),
      1,
    );

    patient = withMedicalStatus(patient, "poisoned", {
      remainingRounds: 1,
    });

    patient = withAuthoringTestItem(patient, "med-kit");

    let partner = positionTribute(
      createAuthoringTestTribute({
        id: "partner",
      }),
      2,
    );

    partner = withAuthoringTestItem(partner, "antidote");

    const plan = findMedicalTreatmentPlan(
      createSharedGame(patient, partner),

      patient,
    );

    expect(plan?.selection.item.definitionId).toBe("antidote");

    expect(plan?.selection.owner.id).toBe(partner.id);
  });

  it("prefers patient-owned medicine over equivalent borrowed medicine", () => {
    let patient = positionTribute(
      createAuthoringTestTribute({
        id: "patient",
      }),
      1,
    );

    patient = withMedicalStatus(patient, "bleeding", {
      remainingRounds: 1,
    });

    patient = withAuthoringTestItem(patient, "bandages");

    let partner = positionTribute(
      createAuthoringTestTribute({
        id: "partner",
      }),
      2,
    );

    partner = withAuthoringTestItem(partner, "bandages");

    const plan = findMedicalTreatmentPlan(
      createSharedGame(patient, partner),

      patient,
    );

    expect(plan?.selection.owner.id).toBe(patient.id);
  });

  it("uses a med kit when no specific treatment is accessible", () => {
    let patient = createAuthoringTestTribute({
      id: "fallback-patient",
    });

    patient = withMedicalStatus(patient, "burned");

    patient = withAuthoringTestItem(patient, "med-kit");

    const plan = findMedicalTreatmentPlan(
      createAuthoringTestGame([patient]),

      patient,
    );

    expect(plan?.selection.item.definitionId).toBe("med-kit");
  });

  it("prefers the narrowest owned treatment when multiple specific items match", () => {
    let patient = createAuthoringTestTribute({
      id: "specific-patient",
    });

    patient = withMedicalStatus(patient, "injured");

    patient = withAuthoringTestItem(patient, "bandages");

    patient = withAuthoringTestItem(patient, "painkillers");

    const plan = findMedicalTreatmentPlan(
      createAuthoringTestGame([patient]),

      patient,
    );

    expect(plan?.selection.item.definitionId).toBe("painkillers");
  });

  it("returns the same plan for repeated evaluations", () => {
    let patient = createAuthoringTestTribute({
      id: "deterministic-patient",
    });

    patient = withMedicalStatus(patient, "injured", {
      severity: 2,
    });

    patient = withAuthoringTestItem(patient, "bandages");

    patient = withAuthoringTestItem(patient, "painkillers");

    const game = createAuthoringTestGame([patient]);

    const firstPlan = findMedicalTreatmentPlan(game, patient);

    const secondPlan = findMedicalTreatmentPlan(game, patient);

    expect(secondPlan).toEqual(firstPlan);
  });

  it("does not consume medicine for a condition the item cannot treat", () => {
    let patient = createAuthoringTestTribute({
      id: "untreatable-patient",
    });

    patient = withMedicalStatus(patient, "poisoned", {
      remainingRounds: 1,
    });

    patient = withAuthoringTestItem(patient, "painkillers");

    expect(
      findMedicalTreatmentPlan(
        createAuthoringTestGame([patient]),

        patient,
      ),
    ).toBeNull();
  });

  it("classifies med kits as broad fallback treatment", () => {
    expect(isBroadMedicalTreatment("med-kit")).toBe(true);

    expect(isBroadMedicalTreatment("antidote")).toBe(false);
  });
});
