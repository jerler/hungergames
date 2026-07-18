import { describe, expect, it } from "vitest";

import {
  createBlankTributeDrafts,
  createRandomTributeDrafts,
} from "~/game/tributes/tribute-drafts";

import { validateTributeDrafts } from "./reaping-validation";

describe("validateTributeDrafts", () => {
  it("accepts a complete roster", () => {
    const tributes = createRandomTributeDrafts(6);

    const result = validateTributeDrafts(tributes, 6);

    expect(result.isValid).toBe(true);
    expect(result.summaryErrors).toEqual([]);
    expect(result.tributeErrors).toEqual({});
  });

  it("identifies every blank tribute name", () => {
    const tributes = createBlankTributeDrafts(6);

    const result = validateTributeDrafts(tributes, 6);

    expect(result.isValid).toBe(false);
    expect(Object.keys(result.tributeErrors)).toHaveLength(12);

    expect(result.summaryErrors).toContain("12 tributes need a name.");
  });
});
