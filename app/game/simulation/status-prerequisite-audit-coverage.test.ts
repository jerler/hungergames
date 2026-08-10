import { describe, expect, it } from "vitest";

import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import { getEventAuditPrerequisiteEvidence } from "~/game/events/event-audit-prerequisites";
import type { EventDefinition } from "~/game/events/event-schema";

function getActiveDefinitions(): EventDefinition[] {
  const definitions = new Map<string, EventDefinition>();

  for (const family of [
    ...BLOODBATH_EVENT_CATALOGUE_FAMILIES,
    ...ORDINARY_EVENT_CATALOGUE_FAMILIES,
  ]) {
    for (const definition of family.events as readonly EventDefinition[]) {
      definitions.set(definition.id, definition);
    }
  }

  return [...definitions.values()];
}

function getDefinition(definitions: readonly EventDefinition[], id: string): EventDefinition {
  const definition = definitions.find((candidate) => candidate.id === id);

  if (!definition) {
    throw new Error(`Expected active definition "${id}".`);
  }

  return definition;
}

describe("Phase 3 typed status prerequisite coverage", () => {
  const definitions = getActiveDefinitions();

  it("gives every active status-requirement definition typed status evidence", () => {
    const statusRequired = definitions.filter(
      (definition) =>
        definition.selectionProfile?.specificityReasons.includes("status-requirement") === true,
    );

    expect(statusRequired.length).toBeGreaterThan(20);

    const missing = statusRequired
      .filter((definition) => {
        const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites;

        return !prerequisites.some(
          (prerequisite) => prerequisite.kind === "status" || prerequisite.kind === "status-any",
        );
      })
      .map((definition) => definition.id)
      .sort();

    expect(missing).toEqual([]);
  });

  it("preserves severity-aware status gates", () => {
    const definition = getDefinition(definitions, "status-emergency-bark-buffet");
    const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites;

    expect(prerequisites).toContainEqual(
      expect.objectContaining({
        kind: "status",
        roleId: "actor",
        statusId: "hungry",
        present: true,
        minimumSeverity: 2,
      }),
    );
  });

  it("preserves OR-gated status alternatives", () => {
    const definition = getDefinition(definitions, "high-brains-lead-a-horse-to-water");
    const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites;

    const statusAny = prerequisites.find(
      (prerequisite) => prerequisite.kind === "status-any" && prerequisite.roleId === "actor",
    );

    expect(statusAny).toEqual(
      expect.objectContaining({
        kind: "status-any",
        alternatives: expect.arrayContaining([
          expect.objectContaining({
            statusId: "alert",
            present: true,
          }),
          expect.objectContaining({
            statusId: "hidden",
            present: true,
          }),
        ]),
      }),
    );
  });

  it("preserves group-existential status gates", () => {
    const definition = getDefinition(definitions, "status-rationing-becomes-personal-2");
    const prerequisites = getEventAuditPrerequisiteEvidence(definition).prerequisites;

    expect(prerequisites).toContainEqual(
      expect.objectContaining({
        kind: "status",
        roleId: "members",
        statusId: "hungry",
        present: true,
        minimumMatchingCount: 1,
      }),
    );
  });

  it("preserves shared-helper and mixed status/truce gates", () => {
    const hallucinatory = getDefinition(definitions, "status-hallucinatory-jury-cliff");
    expect(getEventAuditPrerequisiteEvidence(hallucinatory).prerequisites).toContainEqual(
      expect.objectContaining({
        kind: "status",
        roleId: "actor",
        statusId: "disoriented",
        present: true,
      }),
    );

    const watch = getDefinition(definitions, "status-watch-ends-early-2");
    const watchPrerequisites = getEventAuditPrerequisiteEvidence(watch).prerequisites;

    expect(watchPrerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "status",
          roleId: "actor",
          statusId: "exhausted",
          present: true,
        }),
        expect.objectContaining({
          kind: "truce",
          roleId: "actor",
          truceKind: "standard",
          exactSize: 2,
        }),
      ]),
    );
  });
});
