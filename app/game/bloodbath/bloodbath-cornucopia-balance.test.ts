import { describe, expect, it } from "vitest";

import type { EventDefinition } from "~/game/events/event-schema";

import {
  getBloodbathFatalTuningMultiplier,
  type CornucopiaFatalProfile,
} from "./bloodbath-cornucopia-balance";

function createDefinition(id: string, participantCount: number): EventDefinition {
  return {
    id,
    category: "fatal",
    tags: ["fatal"],
    periods: ["day"],
    baseWeight: 1,
    roles: [
      {
        id: "tributes",
        count: participantCount,
      },
    ],
    resolve: () => ({
      text: id,
      changes: [],
    }),
  };
}

function createProfile(
  id: string,
  participantCount: number,
  minimumEliminations: number,
  maximumEliminations = minimumEliminations,
): CornucopiaFatalProfile {
  return {
    definition: createDefinition(id, participantCount),
    minImmediateEliminations: minimumEliminations,
    maxImmediateEliminations: maximumEliminations,
  };
}

describe("Bloodbath Cornucopia fatal tuning", () => {
  it("favours guaranteed multi-participant fatal progress", () => {
    expect(getBloodbathFatalTuningMultiplier(createProfile("solo", 1, 1))).toBeCloseTo(0.15);
    expect(getBloodbathFatalTuningMultiplier(createProfile("pair", 2, 1))).toBeCloseTo(1.5);
    expect(getBloodbathFatalTuningMultiplier(createProfile("trio", 3, 2))).toBeCloseTo(3.75);
    expect(getBloodbathFatalTuningMultiplier(createProfile("variable-trio", 3, 0, 2))).toBeCloseTo(
      0.525,
    );
  });

  it("rejects invalid fatality ranges", () => {
    expect(() => getBloodbathFatalTuningMultiplier(createProfile("invalid", 2, 2, 1))).toThrow(
      /invalid elimination range/i,
    );
  });
});
