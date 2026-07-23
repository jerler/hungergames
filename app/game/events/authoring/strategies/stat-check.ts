import type { EventResolutionStrategy } from "~/game/events/authoring/builder/event-builder-types";
import {
  createEventTextContext,
  type EventText,
} from "~/game/events/authoring/characters/event-text-context";
import type { AuthoredStatCheck } from "~/game/events/authoring/checks/check-schema";
import { compileEffects, validateEffects } from "~/game/events/authoring/effects/compile-effects";
import type { StatCheckResults } from "~/game/events/authoring/outcomes/outcome-schema";
import { resolveOutcomeText } from "~/game/events/authoring/outcomes/resolve-outcome";
import { resolveStatCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant } from "~/game/events/event-schema";

interface StatCheckStrategyOptions {
  intro?: EventText;
}

function getAuthoredOutcomeKey(outcome: StatCheckOutcome): keyof StatCheckResults {
  switch (outcome) {
    case "critical-failure":
      return "criticalFailure";

    case "failure":
      return "failure";

    case "success":
      return "success";

    case "exceptional-success":
      return "exceptionalSuccess";
  }
}

export function statCheck(
  roleId: string,
  check: AuthoredStatCheck,
  outcomes: StatCheckResults,
  { intro }: StatCheckStrategyOptions = {},
): EventResolutionStrategy {
  return {
    validate(eventId, roleIds): void {
      if (!roleIds.includes(roleId)) {
        throw new Error(`Event "${eventId}": stat check ` + `references unknown role "${roleId}".`);
      }

      if (!Number.isInteger(check.difficulty) || check.difficulty < 1 || check.difficulty > 5) {
        throw new Error(
          `Event "${eventId}": stat-check ` + `difficulty must be an integer from 1 to 5.`,
        );
      }

      const requiredOutcomeKeys = [
        "criticalFailure",
        "failure",
        "success",
        "exceptionalSuccess",
      ] as const;

      for (const outcomeKey of requiredOutcomeKeys) {
        const eventResult = outcomes[outcomeKey];

        if (!eventResult) {
          throw new Error(
            `Event "${eventId}": stat check ` + `is missing outcome "${outcomeKey}".`,
          );
        }

        validateEffects(eventId, eventResult.effects, roleIds);
      }
    },

    resolve(context, roleIds) {
      const tribute = requireSingleParticipant(context.participantsByRole, roleId);

      const outcome = check.luckAdjusted
        ? resolveLuckAdjustedStatCheck(tribute, check.stat, check.difficulty, context.random)
        : resolveStatCheck({
            stats: tribute.snapshot.stats,

            stat: check.stat,

            difficulty: check.difficulty,

            random: context.random,
          });

      const eventResult = outcomes[getAuthoredOutcomeKey(outcome)];

      const textContext = createEventTextContext(context, roleIds);

      return {
        text: resolveOutcomeText(context.eventId, eventResult, textContext, intro),

        changes: compileEffects(eventResult.effects, context),
      };
    },
  };
}
