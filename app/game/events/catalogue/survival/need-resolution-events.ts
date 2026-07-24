import { createFatalChanges } from "~/game/events/event-change-builders";
import type { SurvivalNeed } from "~/game/survival/survival-schema";
import type { GameTribute, ResolvedEvent, RoundReference } from "~/game/types/game-state";

interface NeedFatalityCopy {
  definitionId: string;
  causeId: string;
  causeLabel: string;
  fatalSummary: string;
}

const NEED_FATALITY_COPY = {
  water: {
    definitionId: "need-fatality:dehydration",

    causeId: "survival-need:water",
    causeLabel: "Dehydration",

    fatalSummary: "succumbs to severe dehydration.",
  },

  food: {
    definitionId: "need-fatality:starvation",

    causeId: "survival-need:food",
    causeLabel: "Starvation",

    fatalSummary: "succumbs to starvation.",
  },
} as const satisfies Record<SurvivalNeed, NeedFatalityCopy>;

export function createFatalNeedResolutionEvent(
  tribute: GameTribute,
  need: SurvivalNeed,
  round: RoundReference,
): ResolvedEvent {
  const copy = NEED_FATALITY_COPY[need];

  const eventId = ["need-fatality", round.period, round.day, tribute.id, need].join(":");

  const text = [tribute.snapshot.name, copy.fatalSummary].join(" ");

  return {
    id: eventId,
    definitionId: copy.definitionId,

    kind: "need-resolution",
    resolutionMode: "standard",

    round: {
      ...round,
    },

    participantTributeIds: [tribute.id],

    text,

    /*
     * Passing no killer creates only an elimination:
     *
     * - no kill statistic
     * - no attempted-kill statistic
     * - no inventory transfer
     */
    changes: createFatalChanges(tribute, copy.causeId, copy.causeLabel, text),
  };
}
