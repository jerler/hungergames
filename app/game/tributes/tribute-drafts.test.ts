import { describe, expect, it } from "vitest";

import { DEFAULT_TRIBUTES } from "./default-tributes";
import {
  createBlankTributeDrafts,
  createRandomTributeDrafts,
  haveTributeDraftsBeenEdited,
  randomizeTributeDraft,
} from "./tribute-drafts";

describe("tribute draft utilities", () => {
  it("creates two blank tribute slots per district", () => {
    const tributes = createBlankTributeDrafts(6);

    expect(tributes).toHaveLength(12);

    expect(tributes[0]).toMatchObject({
      district: 1,
      districtPosition: 1,
      name: "",
      pronouns: "they",
      sourceDefinitionId: null,
    });

    expect(tributes[11]).toMatchObject({
      district: 6,
      districtPosition: 2,
    });
  });

  it("preserves pronouns when rerolling a tribute", () => {
    const originalTributes = createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5);

    const tributeToReplace = originalTributes[0];

    const updatedTributes = randomizeTributeDraft(
      originalTributes,
      tributeToReplace.id,
      DEFAULT_TRIBUTES,
      () => 0,
    );

    expect(updatedTributes[0].pronouns).toBeDefined();
  });

  it("randomly assigns unique predefined tributes", () => {
    const tributes = createRandomTributeDrafts(12, DEFAULT_TRIBUTES, () => 0.5);

    const definitionIds = tributes.map((tribute) => tribute.sourceDefinitionId);

    expect(tributes).toHaveLength(24);

    expect(new Set(definitionIds).size).toBe(24);
  });

  it("rerolls one tribute without duplicating another tribute", () => {
    const originalTributes = createRandomTributeDrafts(6, DEFAULT_TRIBUTES, () => 0.5);

    const tributeToReplace = originalTributes[0];

    const updatedTributes = randomizeTributeDraft(
      originalTributes,
      tributeToReplace.id,
      DEFAULT_TRIBUTES,
      () => 0,
    );

    const definitionIds = updatedTributes.map((tribute) => tribute.sourceDefinitionId);

    expect(new Set(definitionIds).size).toBe(definitionIds.length);

    expect(updatedTributes.slice(1).map((tribute) => tribute.id)).toEqual(
      originalTributes.slice(1).map((tribute) => tribute.id),
    );
  });

  it("detects edits to blank tribute drafts", () => {
    const blankTributes = createBlankTributeDrafts(6);

    expect(haveTributeDraftsBeenEdited(blankTributes)).toBe(false);

    const editedTributes = blankTributes.map((tribute, index) =>
      index === 0
        ? {
            ...tribute,
            name: "Katniss",
          }
        : tribute,
    );

    expect(haveTributeDraftsBeenEdited(editedTributes)).toBe(true);
  });
});
