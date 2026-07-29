// Phase 2 event specificity validation tests.
import { describe, expect, it } from "vitest";

import type { EventDefinition } from "~/game/events/event-schema";

import { validateEventDefinition } from "./validate-event-definition";

function createDefinition(): EventDefinition {
  return {
    id: "specificity-validation-event",
    category: "survival",
    periods: ["day"],
    baseWeight: 1,
    tags: ["survival"],
    roles: [
      {
        id: "actor",
        count: 1,
      },
    ],
    resolve: () => ({
      text: "A test event occurs.",
      changes: [],
    }),
  };
}

describe("event specificity validation", () => {
  it("accepts a positive score with unique known reasons", () => {
    expect(() =>
      validateEventDefinition({
        ...createDefinition(),
        selectionProfile: {
          specificityScore: 4,
          specificityReasons: ["truce-requirement", "item-requirement"],
        },
      }),
    ).not.toThrow();
  });

  it("rejects invalid specificity scores", () => {
    expect(() =>
      validateEventDefinition({
        ...createDefinition(),
        selectionProfile: {
          specificityScore: 0,
          specificityReasons: ["item-requirement"],
        },
      }),
    ).toThrow(/invalid specificity score/i);
  });

  it("rejects duplicate specificity reasons", () => {
    expect(() =>
      validateEventDefinition({
        ...createDefinition(),
        selectionProfile: {
          specificityScore: 2,
          specificityReasons: ["item-requirement", "item-requirement"],
        },
      }),
    ).toThrow(/duplicate specificity reasons/i);
  });
});
