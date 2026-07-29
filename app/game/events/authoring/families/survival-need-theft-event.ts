import { selectRandomItem } from "~/game/engine/random";
import {
  getSurvivalNeedTheftDifficulty,
  getSurvivalNeedTheftTargetWeight,
  getSurvivalNeedTheftThiefWeight,
  isEligibleSurvivalNeedTheftTarget,
} from "~/game/engine/survival-theft-formulas";
import { createEvent } from "~/game/events/authoring/builder/create-event";
import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import { applyStatus } from "~/game/events/authoring/effects/status-effects";
import { kill } from "~/game/events/authoring/effects/fatal-effects";
import { satisfySurvivalNeed } from "~/game/events/authoring/effects/survival-effects";
import { survived } from "~/game/events/authoring/effects/statistic-effects";
import { result } from "~/game/events/authoring/outcomes/result";
import { opposedTargetRole, soloRole } from "~/game/events/authoring/roles/role-presets";
import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import type { EventEffect } from "~/game/events/authoring/effects/effect-schema";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

export interface SurvivalNeedTheftOutcomeTexts {
  criticalFailure: readonly EventText[];
  failure: readonly EventText[];
  success: readonly EventText[];
  exceptionalSuccess: readonly EventText[];
}

export interface SurvivalNeedTheftEventOptions {
  need: SurvivalNeed;
  texts: SurvivalNeedTheftOutcomeTexts;
  weight?: number;
}

function validateTexts(eventId: string, texts: SurvivalNeedTheftOutcomeTexts): void {
  for (const [outcome, variants] of Object.entries(texts)) {
    if (variants.length < 2) {
      throw new Error(
        `Resource-theft event "${eventId}" outcome "${outcome}" requires at least two text variants.`,
      );
    }
  }
}

function createResult(text: EventText, effects: readonly EventEffect[]) {
  return result({
    text,
    effects,
  });
}

function requireRepresentativeText(
  eventId: string,
  outcome: keyof SurvivalNeedTheftOutcomeTexts,
  texts: SurvivalNeedTheftOutcomeTexts,
): EventText {
  const text = texts[outcome][0];

  if (!text) {
    throw new Error(
      `Resource-theft event "${eventId}" is missing representative text for "${outcome}".`,
    );
  }

  return text;
}

export function createSurvivalNeedTheftEvent(
  id: string,
  { need, texts, weight = 1.5 }: SurvivalNeedTheftEventOptions,
): EventDefinition {
  validateTexts(id, texts);

  const criticalFailureEffects = [
    kill("target", "thief", {
      causeId: id,
      causeLabel: need === "food" ? "Killed while stealing a meal" : "Killed while stealing water",
    }),
    survived("target"),
  ] as const satisfies readonly EventEffect[];

  const failureEffects = [
    applyStatus("thief", "hunted", 1),
    survived("thief"),
    survived("target"),
  ] as const satisfies readonly EventEffect[];

  const successEffects = [
    satisfySurvivalNeed("thief", need),
    survived("thief"),
    survived("target"),
  ] as const satisfies readonly EventEffect[];

  const representativeResults = [
    createResult(requireRepresentativeText(id, "criticalFailure", texts), criticalFailureEffects),
    createResult(requireRepresentativeText(id, "failure", texts), failureEffects),
    createResult(requireRepresentativeText(id, "success", texts), successEffects),
    createResult(requireRepresentativeText(id, "exceptionalSuccess", texts), successEffects),
  ];

  return createEvent(id)
    .roles(
      soloRole("thief", {
        getWeight: (thief, context) => getSurvivalNeedTheftThiefWeight(need, thief, context),
      }),
      opposedTargetRole("target", "thief", {
        isEligible: (target, context) => isEligibleSurvivalNeedTheftTarget(need, target, context),
        getWeight: getSurvivalNeedTheftTargetWeight,
      }),
    )
    .category("hazard")
    .tags("hazard", "resource", "deprivation")
    .during("day")
    .weight(weight)
    .addresses({
      kind: "survival-need",
      roleId: "thief",
      need,
    })
    .resolve(
      customResolution(
        (context, helpers) => {
          const thief = requireSingleParticipant(context.participantsByRole, "thief");
          const target = requireSingleParticipant(context.participantsByRole, "target");

          const outcome = resolveLuckAdjustedStatCheck(
            thief,
            "brains",
            getSurvivalNeedTheftDifficulty(target, context.round),
            context.random,
          );

          const outcomeTexts = (() => {
            switch (outcome) {
              case "critical-failure":
                return texts.criticalFailure;

              case "failure":
                return texts.failure;

              case "success":
                return texts.success;

              case "exceptional-success":
                return texts.exceptionalSuccess;
            }
          })();

          const selectedText = selectRandomItem(outcomeTexts, context.random);

          switch (outcome) {
            case "critical-failure":
              return helpers.resolveResult(createResult(selectedText, criticalFailureEffects));

            case "failure":
              return helpers.resolveResult(createResult(selectedText, failureEffects));

            case "success":
            case "exceptional-success":
              return helpers.resolveResult(createResult(selectedText, successEffects));
          }
        },
        {
          possibleResults: representativeResults,
        },
      ),
    );
}
