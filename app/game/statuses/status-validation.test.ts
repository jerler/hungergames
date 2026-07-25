import { describe, expect, it } from "vitest";

import { STATUS_CATALOGUE, getStatusDefinition } from "./status-catalogue";

import { validateStatusCatalogue, validateStatusDefinition } from "./status-validation";

import type {
  FatalStatusDefinition,
  PersistentStatusDefinition,
  RecoveringStatusDefinition,
  StatusDefinition,
} from "./status-schema";

function isFatalStatusDefinition(
  definition: StatusDefinition,
): definition is FatalStatusDefinition {
  return definition.duration.kind === "timed" && definition.duration.expiration === "fatal";
}

function isRecoveringStatusDefinition(
  definition: StatusDefinition,
): definition is RecoveringStatusDefinition {
  return definition.duration.kind === "timed" && definition.duration.expiration === "recover";
}

function isPersistentStatusDefinition(
  definition: StatusDefinition,
): definition is PersistentStatusDefinition {
  return definition.duration.kind === "persistent";
}

function requireFatalStatusDefinition(
  statusId: FatalStatusDefinition["id"],
): FatalStatusDefinition {
  const definition = getStatusDefinition(statusId);

  if (!isFatalStatusDefinition(definition)) {
    throw new Error(`Expected "${statusId}" to be a fatal status.`);
  }

  return definition;
}

function requireRecoveringStatusDefinition(
  statusId: RecoveringStatusDefinition["id"],
): RecoveringStatusDefinition {
  const definition = getStatusDefinition(statusId);

  if (!isRecoveringStatusDefinition(definition)) {
    throw new Error(`Expected "${statusId}" to be a recovering status.`);
  }

  return definition;
}

function requirePersistentStatusDefinition(
  statusId: PersistentStatusDefinition["id"],
): PersistentStatusDefinition {
  const definition = getStatusDefinition(statusId);

  if (!isPersistentStatusDefinition(definition)) {
    throw new Error(`Expected "${statusId}" to be a persistent status.`);
  }

  return definition;
}

describe("status validation", () => {
  it("accepts the production catalogue", () => {
    expect(() => validateStatusCatalogue(STATUS_CATALOGUE)).not.toThrow();
  });

  it("rejects duplicate status IDs", () => {
    const injured = getStatusDefinition("injured");

    expect(() => validateStatusCatalogue([injured, injured])).toThrow(/duplicate IDs/i);
  });

  it("rejects invalid timed durations", () => {
    const injured = requireRecoveringStatusDefinition("injured");

    expect(() =>
      validateStatusDefinition({
        ...injured,

        duration: {
          kind: "timed",

          defaultRounds: 0,

          expiration: "recover",
        },
      }),
    ).toThrow(/invalid default duration/i);
  });

  it("requires fatality copy for fatal statuses", () => {
    const bleeding = requireFatalStatusDefinition("bleeding");

    expect(() =>
      validateStatusDefinition({
        ...bleeding,

        fatalCauseLabel: "",
      }),
    ).toThrow(/fatal cause label/i);
  });

  it("requires removal instructions for persistent statuses", () => {
    const hungry = requirePersistentStatusDefinition("hungry");

    expect(() =>
      validateStatusDefinition({
        ...hungry,

        removalDescription: "",
      }),
    ).toThrow(/removal description/i);
  });

  it("rejects non-finite modifiers", () => {
    const injured = getStatusDefinition("injured");

    expect(() =>
      validateStatusDefinition({
        ...injured,

        modifiers: {
          ...injured.modifiers,

          combatPerSeverity: Number.NaN,
        },
      }),
    ).toThrow(/combatPerSeverity/i);
  });
});
