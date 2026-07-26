import { describe, expect, it } from "vitest";

import type { StatusEffect } from "~/game/types/game-state";

import { compareStatusesByUrgency, createStatusPresentation } from "./status-presentation";

function createStatus(
  definitionId: StatusEffect["definitionId"],

  remainingRounds: number | null,

  severity: StatusEffect["severity"] = 1,
): StatusEffect {
  return {
    id: `status-${definitionId}`,

    definitionId,
    severity,
    remainingRounds,

    sourceEventId: `event-${definitionId}`,

    sourceTributeId: null,

    appliedRound: {
      day: 2,

      period: "night",
    },
  };
}

describe("status presentation", () => {
  it("presents persistent needs with removal conditions", () => {
    const details = createStatusPresentation(createStatus("hungry", null));

    expect(details).toMatchObject({
      label: "Hungry",

      tone: "warning",

      kindLabel: "Persistent need",

      durationLabel: "Persistent",

      lifecycleSummary: "Remains until the tribute eats enough food to recover.",
    });
  });

  it("presents fatal urgency and attribution", () => {
    const status = {
      ...createStatus("poisoned", 1, 3),

      sourceTributeId: "attacker",
    };

    const details = createStatusPresentation(status, {
      sourceTributeName: "The Babadook",
    });

    expect(details).toMatchObject({
      tone: "critical",

      severityLabel: "Severity 3 of 3",

      lifecycleSummary: "Fatal at the end of the next round if untreated.",

      sourceLabel: "Caused by The Babadook.",

      fatalCauseLabel: "Poisoning",
    });

    expect(details.fatalConsequence).toContain("succumbs to the poison");
  });

  it("shows severity-scaled gameplay effects", () => {
    const details = createStatusPresentation(createStatus("injured", 2, 2));

    expect(details.effectSummaries).toEqual(
      expect.arrayContaining([
        "Combat score −1.1",
        "Survival score −0.6",
        "Awareness score −0.2",
        "Foraging score −0.4",
      ]),
    );
  });

  it("explains special Lucky and Hidden behavior", () => {
    expect(createStatusPresentation(createStatus("lucky", 2, 2)).effectSummaries).toContain(
      "Effective Luck +2, up to 5.",
    );

    expect(createStatusPresentation(createStatus("hidden", 2, 3)).effectSummaries).toContain(
      "Excluded from ordinary hostile targeting.",
    );
  });

  it("sorts fatal and harmful conditions before beneficial statuses", () => {
    const statuses = [
      createStatus("lucky", 1),

      createStatus("hungry", null),

      createStatus("injured", 1),

      createStatus("poisoned", 1),
    ].sort(compareStatusesByUrgency);

    expect(statuses.map((status) => status.definitionId)).toEqual([
      "poisoned",
      "injured",
      "hungry",
      "lucky",
    ]);
  });
});
