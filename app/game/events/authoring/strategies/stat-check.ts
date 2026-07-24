import type { EventResolutionStrategy } from "~/game/events/authoring/builder/event-builder-types";
import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import type { AuthoredStatCheck } from "~/game/events/authoring/checks/check-schema";
import { validateEffects } from "~/game/events/authoring/effects/compile-effects";
import type { StatCheckResults } from "~/game/events/authoring/outcomes/outcome-schema";
import {
  getConcreteEventResults,
  resolveAuthoredOutcome,
} from "~/game/events/authoring/outcomes/random-result";
import { resolveAuthoredResult } from "~/game/events/authoring/outcomes/resolve-authored-result";
import { EVENT_STATS, resolveStatCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant } from "~/game/events/event-schema";
import { getEffectiveStats } from "~/game/engine/effective-stats";

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
    validate(eventId, roleIds, requiredItemRoleIds): void {
      if (!roleIds.includes(roleId)) {
        throw new Error(`Event "${eventId}": stat check ` + `references unknown role "${roleId}".`);
      }

      if (!EVENT_STATS.includes(check.stat)) {
        throw new Error(
          `Event "${eventId}": stat check references unknown stat "${String(check.stat)}".`,
        );
      }

      if (!Number.isInteger(check.difficulty) || check.difficulty < 1 || check.difficulty > 5) {
        throw new Error(
          `Event "${eventId}": stat-check ` + "difficulty must be an integer from 1 to 5.",
        );
      }

      const requiredOutcomeKeys = [
        "criticalFailure",
        "failure",
        "success",
        "exceptionalSuccess",
      ] as const;

      for (const outcomeKey of requiredOutcomeKeys) {
        const authoredOutcome = outcomes[outcomeKey];

        if (!authoredOutcome) {
          throw new Error(
            `Event "${eventId}": stat check ` + `is missing outcome "${outcomeKey}".`,
          );
        }

        const concreteResults = getConcreteEventResults(authoredOutcome);

        if (concreteResults.length === 0) {
          throw new Error(
            `Event "${eventId}": stat check outcome ` +
              `"${outcomeKey}" must contain at least one result.`,
          );
        }

        for (const eventResult of concreteResults) {
          validateEffects(eventId, eventResult.effects, roleIds, requiredItemRoleIds);
        }
      }
    },

    resolve(context, roleIds) {
      const tribute = requireSingleParticipant(context.participantsByRole, roleId);

      const outcome = check.luckAdjusted
        ? resolveLuckAdjustedStatCheck(tribute, check.stat, check.difficulty, context.random)
        : resolveStatCheck({
            stats: getEffectiveStats(tribute),

            stat: check.stat,
            difficulty: check.difficulty,

            random: context.random,
          });

      const authoredOutcome = outcomes[getAuthoredOutcomeKey(outcome)];

      const eventResult = resolveAuthoredOutcome(authoredOutcome, context.random);

      return resolveAuthoredResult(eventResult, context, roleIds, intro);
    },
  };
}
