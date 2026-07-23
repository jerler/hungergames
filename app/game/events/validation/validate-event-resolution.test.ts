import { describe, expect, it } from "vitest";

import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import type { EventResolution } from "~/game/events/event-schema";
import type { RoundReference } from "~/game/types/game-state";
import { validateEventResolution } from "./validate-event-resolution";

const DAY_ONE = {
  day: 1,
  period: "day",
} as const;

const DAY_TWO = {
  day: 2,
  period: "day",
} as const;

function validate(resolution: EventResolution, round: RoundReference = DAY_TWO): void {
  validateEventResolution({
    eventId: "resolved-event",
    definitionId: "test-event",
    round,
    resolution,
  });
}

describe("validateEventResolution", () => {
  it("accepts a valid natural acquisition", () => {
    const item = createInventoryItemInstance("resolved-event", "tribute", "water", DAY_TWO);

    expect(() =>
      validate({
        text: "A tribute finds water.",
        changes: [
          {
            type: "acquire-item",
            tributeId: "tribute",
            acquisitionSource: "natural-foraging",
            item,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects manufactured natural-foraging acquisition", () => {
    const item = createInventoryItemInstance("resolved-event", "tribute", "knife", DAY_TWO);

    expect(() =>
      validate({
        text: "Invalid acquisition.",
        changes: [
          {
            type: "acquire-item",
            tributeId: "tribute",
            acquisitionSource: "natural-foraging",
            item,
          },
        ],
      }),
    ).toThrow("cannot acquire manufactured item");
  });

  it("rejects Cornucopia acquisition outside Day 1 daytime", () => {
    const item = createInventoryItemInstance("resolved-event", "tribute", "knife", DAY_TWO);

    expect(() =>
      validate({
        text: "Invalid Cornucopia acquisition.",
        changes: [
          {
            type: "acquire-item",
            tributeId: "tribute",
            acquisitionSource: "cornucopia",
            item,
          },
        ],
      }),
    ).toThrow("outside Day 1 daytime");
  });

  it("accepts Cornucopia acquisition during Day 1 daytime", () => {
    const item = createInventoryItemInstance("resolved-event", "tribute", "knife", DAY_ONE);

    expect(() =>
      validate(
        {
          text: "A tribute claims a knife.",
          changes: [
            {
              type: "acquire-item",
              tributeId: "tribute",
              acquisitionSource: "cornucopia",
              item,
            },
          ],
        },
        DAY_ONE,
      ),
    ).not.toThrow();
  });

  it("rejects unsupported sponsor acquisition", () => {
    const item = createInventoryItemInstance("resolved-event", "tribute", "medicine", DAY_TWO);

    expect(() =>
      validate({
        text: "Invalid sponsor acquisition.",
        changes: [
          {
            type: "acquire-item",
            tributeId: "tribute",
            acquisitionSource: "sponsor",
            item,
          },
        ],
      }),
    ).toThrow("unsupported sponsor acquisition");
  });

  it("rejects empty fatality cause data", () => {
    expect(() =>
      validate({
        text: "A fatal event.",
        changes: [
          {
            type: "eliminate-tribute",
            tributeId: "victim",
            causeId: "",
            causeLabel: "Killed",
            summary: "A fatal event.",
            killerTributeIds: [],
          },
        ],
      }),
    ).toThrow("fatality cause ID must be non-empty");
  });
});
