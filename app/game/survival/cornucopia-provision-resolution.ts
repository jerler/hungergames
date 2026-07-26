import { createStatusChange } from "~/game/events/event-change-builders";
import type { StatCheckOutcome } from "~/game/events/event-outcomes";
import type { EventResolution } from "~/game/events/event-schema";
import { hasDeprivationProtection } from "~/game/items/deprivation-protection";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameTribute, RoundReference } from "~/game/types/game-state";

import type { SurvivalNeed } from "./survival-schema";

export interface CornucopiaProvisionResolutionOptions {
  eventId: string;
  round: RoundReference;
  tribute: GameTribute;
  need: SurvivalNeed;
  outcome: StatCheckOutcome;
}

function createFoodText(tribute: GameTribute, outcome: StatCheckOutcome): string {
  const pronouns = getTributePronouns(tribute);

  switch (outcome) {
    case "critical-failure":
      return (
        `${tribute.snapshot.name}'s stomach begins to growl. ` +
        `${pronouns.subject} nearly drops the remaining ` +
        "Cornucopia rations into the mud, but rescues " +
        "enough to eat."
      );

    case "failure":
      return (
        `${tribute.snapshot.name} reluctantly opens one ` +
        "of the less appealing cans from the Cornucopia " +
        "and forces down the contents."
      );

    case "success":
      return (
        `${tribute.snapshot.name} finds a safe place to ` +
        "eat from the food supplies carried away from " +
        "the Cornucopia."
      );

    case "exceptional-success":
      return (
        `${tribute.snapshot.name} turns the remaining ` +
        "Cornucopia provisions into a surprisingly " +
        "satisfying meal and regains some strength."
      );
  }
}

function createWaterText(tribute: GameTribute, outcome: StatCheckOutcome): string {
  const pronouns = getTributePronouns(tribute);

  switch (outcome) {
    case "critical-failure":
      return (
        `${tribute.snapshot.name} fumbles with a water ` +
        "container from the Cornucopia and spills most " +
        `of it, but ${pronouns.subject} saves enough to drink.`
      );

    case "failure":
      return (
        `${tribute.snapshot.name} drinks from a dented ` +
        "container carried away from the Cornucopia. " +
        "The water is warm, but it does the job."
      );

    case "success":
      return (
        `${tribute.snapshot.name} finds a quiet place ` +
        "and drinks from the water supplies claimed " +
        "during the Bloodbath."
      );

    case "exceptional-success":
      return (
        `${tribute.snapshot.name} rests in the shade ` +
        "and carefully drinks from the Cornucopia " +
        "supplies, emerging refreshed and strengthened."
      );
  }
}

export function resolveCornucopiaProvisionNeed({
  eventId,
  round,
  tribute,
  need,
  outcome,
}: CornucopiaProvisionResolutionOptions): EventResolution {
  if (!hasDeprivationProtection(tribute, need)) {
    throw new Error(
      `Tribute "${tribute.id}" cannot resolve protected ` +
        `${need} without deprivation-protecting provisions.`,
    );
  }

  return {
    text: need === "food" ? createFoodText(tribute, outcome) : createWaterText(tribute, outcome),
    changes: [
      {
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need,
      },
      ...(outcome === "exceptional-success"
        ? [createStatusChange(eventId, tribute, "well-fed", 1, round)]
        : []),
    ],
  };
}
