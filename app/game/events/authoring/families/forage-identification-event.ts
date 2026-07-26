import { selectWeightedItem, type RandomSource } from "~/game/engine/random";

import { getEffectiveStats } from "~/game/engine/effective-stats";

import { createEvent } from "~/game/events/authoring/builder/create-event";

import { acquireNaturalResource } from "~/game/events/authoring/effects/natural-resource-effects";

import { applyStatus } from "~/game/events/authoring/effects/status-effects";
import { satisfySurvivalNeed } from "~/game/events/authoring/effects/survival-effects";

import { survived } from "~/game/events/authoring/effects/statistic-effects";

import {
  createSelectedRoleItemUseChanges,
  getSelectedRoleItem,
} from "~/game/events/authoring/items/selected-role-item";

import { result } from "~/game/events/authoring/outcomes/result";

import type { EventResult } from "~/game/events/authoring/outcomes/outcome-schema";

import { foragerRole } from "~/game/events/authoring/roles/role-presets";

import type { AuthoredRoleOptions } from "~/game/events/authoring/roles/role-schema";

import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";

import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";

import { isSuccessfulStatCheckOutcome, type StatCheckOutcome } from "~/game/events/event-outcomes";

import {
  requireSingleParticipant,
  type EventDefinition,
  type EventItemSelection,
} from "~/game/events/event-schema";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { GameTribute } from "~/game/types/game-state";

import type { TributeStatValue } from "~/game/types/tribute";

import { mergeEventTags, type EventFamilyMetadata } from "./family-types";

export const HIDDEN_FORAGE_TYPES = ["safe", "hallucinogenic", "poisonous"] as const;

export type HiddenForageType = (typeof HIDDEN_FORAGE_TYPES)[number];

export const HIDDEN_FORAGE_WEIGHTS = {
  safe: 2,
  hallucinogenic: 1,
  poisonous: 1,
} as const satisfies Record<HiddenForageType, number>;

export const HARMFUL_FORAGE_RETENTION_BRAINS = 4 as const;

const HIDDEN_FORAGE_POOL = HIDDEN_FORAGE_TYPES.map((type) => ({
  type,
  weight: HIDDEN_FORAGE_WEIGHTS[type],
}));

export interface ForageItemDefinitions {
  hallucinogenic: ItemDefinitionId;
  poisonous: ItemDefinitionId;
}

export interface ForageIdentificationEventOptions extends Omit<
  EventFamilyMetadata,
  "category" | "roleOptions"
> {
  /**
   * Player-facing plural noun, such as
   * "berries" or "mushrooms".
   */
  forageLabel: string;

  items: ForageItemDefinitions;

  identificationDifficulty?: TributeStatValue;

  retentionBrainsMinimum?: TributeStatValue;

  roleId?: string;

  /**
   * This family owns optional-item selection
   * because the guidebook is part of its
   * central identification mechanic.
   */
  roleOptions?: Omit<AuthoredRoleOptions, "optionalItem">;
}

export function selectHiddenForageType(random: RandomSource): HiddenForageType {
  return selectWeightedItem(HIDDEN_FORAGE_POOL, (entry) => entry.weight, random).type;
}

function getHarmfulDescriptor(hiddenType: Exclude<HiddenForageType, "safe">): string {
  switch (hiddenType) {
    case "hallucinogenic":
      return "hallucinogenic";

    case "poisonous":
      return "poisonous";
  }
}

function getGuidebookPhrase(tribute: GameTribute, selection: EventItemSelection): string {
  if (selection.owner.id === tribute.id) {
    return "their foraging guidebook";
  }

  return `${selection.owner.snapshot.name}'s ` + "foraging guidebook";
}

function createSafeForageText(
  tribute: GameTribute,
  forageLabel: string,
  guidebook: EventItemSelection | null,
  identified: boolean,
): string {
  if (guidebook) {
    return (
      `${tribute.snapshot.name} uses ` +
      `${getGuidebookPhrase(tribute, guidebook)} to identify edible ` +
      `${forageLabel} and eats enough to satisfy their hunger.`
    );
  }

  if (identified) {
    return (
      `${tribute.snapshot.name} carefully identifies ` +
      `the ${forageLabel} as edible and eats enough ` +
      "to satisfy their hunger."
    );
  }

  return (
    `${tribute.snapshot.name} cannot confidently identify ` +
    `the ${forageLabel}, cautiously tastes one, and is ` +
    "relieved to discover that they are safe to eat."
  );
}

function createConsumedHarmfulForageText(
  tribute: GameTribute,
  forageLabel: string,
  hiddenType: Exclude<HiddenForageType, "safe">,
): string {
  switch (hiddenType) {
    case "hallucinogenic":
      return (
        `${tribute.snapshot.name} mistakes the unfamiliar ` +
        `${forageLabel} for food and becomes disoriented ` +
        "after eating them."
      );

    case "poisonous":
      return (
        `${tribute.snapshot.name} mistakes the unfamiliar ` +
        `${forageLabel} for food and is poisoned after ` +
        "eating them."
      );
  }
}

function createIdentifiedHarmfulForageText(
  tribute: GameTribute,
  forageLabel: string,
  hiddenType: Exclude<HiddenForageType, "safe">,
  guidebook: EventItemSelection | null,
  retained: boolean,
): string {
  const identificationPhrase = guidebook
    ? `uses ${getGuidebookPhrase(tribute, guidebook)} to identify`
    : "correctly identifies";

  const descriptor = getHarmfulDescriptor(hiddenType);

  if (retained) {
    return (
      `${tribute.snapshot.name} ${identificationPhrase} ` +
      `the ${forageLabel} as ${descriptor} and carefully ` +
      "stores them for possible later use."
    );
  }

  return (
    `${tribute.snapshot.name} ${identificationPhrase} ` +
    `the ${forageLabel} as ${descriptor}, but decides ` +
    "that carrying them would be too dangerous and leaves them behind."
  );
}

function wasForageIdentified(
  guidebook: EventItemSelection | null,

  identificationOutcome: StatCheckOutcome | null,
): boolean {
  if (guidebook) {
    return true;
  }

  return identificationOutcome !== null && isSuccessfulStatCheckOutcome(identificationOutcome);
}

export function createForageIdentificationEvent(
  id: string,
  {
    forageLabel,
    items,

    identificationDifficulty = 3,

    retentionBrainsMinimum = HARMFUL_FORAGE_RETENTION_BRAINS,

    roleId = "tribute",

    roleOptions = {},

    periods = ["day"],

    weight = 4,

    tags = [],

    requirements = [],
  }: ForageIdentificationEventOptions,
): EventDefinition {
  if (forageLabel.trim().length === 0) {
    throw new Error(`Forage-identification event "${id}" requires a forage label.`);
  }

  const results = {
    safe: result({
      effects: [satisfySurvivalNeed(roleId, "food"), survived(roleId)],
    }),

    hallucinogenicConsumed: result({
      effects: [applyStatus(roleId, "disoriented", 1)],
    }),

    poisonousConsumed: result({
      effects: [applyStatus(roleId, "poisoned", 1)],
    }),

    hallucinogenicRetained: result({
      effects: [acquireNaturalResource(roleId, items.hallucinogenic), survived(roleId)],
    }),

    poisonousRetained: result({
      effects: [acquireNaturalResource(roleId, items.poisonous), survived(roleId)],
    }),

    harmfulLeftBehind: result({
      effects: [survived(roleId)],
    }),
  } as const satisfies Record<string, EventResult>;

  return createEvent(id)
    .roles(
      foragerRole(roleId, {
        ...roleOptions,

        optionalItem: {
          definitionIds: ["foraging-guidebook"],

          access: "accessible",
        },
      }),
    )
    .when(...requirements)
    .category("hazard")
    .tags(
      ...mergeEventTags(
        ["hazard", "item", "status", "resource"],

        tags,
      ),
    )
    .during(...periods)
    .weight(weight)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const tribute = requireSingleParticipant(context.participantsByRole, roleId);

          /*
           * Resolution order is deliberate:
           *
           * 1. Hidden type
           * 2. Identification
           * 3. Retention
           * 4. Consumption or preservation
           */
          const hiddenType = selectHiddenForageType(context.random);

          const guidebook = getSelectedRoleItem(context, roleId);

          if (guidebook && guidebook.item.definitionId !== "foraging-guidebook") {
            throw new Error(
              `Forage-identification event "${id}" selected ` +
                `unexpected optional item ` +
                `"${guidebook.item.definitionId}".`,
            );
          }

          /*
           * A selected guidebook guarantees
           * identification and therefore consumes
           * no identification-check random value.
           */
          const identificationOutcome = guidebook
            ? null
            : resolveLuckAdjustedStatCheck(
                tribute,
                "brains",
                identificationDifficulty,
                context.random,
              );

          const identified = wasForageIdentified(guidebook, identificationOutcome);

          let selectedResult: EventResult;

          let text: string;

          if (hiddenType === "safe") {
            selectedResult = results.safe;

            text = createSafeForageText(tribute, forageLabel, guidebook, identified);
          } else if (!identified) {
            selectedResult =
              hiddenType === "hallucinogenic"
                ? results.hallucinogenicConsumed
                : results.poisonousConsumed;

            text = createConsumedHarmfulForageText(tribute, forageLabel, hiddenType);
          } else {
            const effectiveBrains = getEffectiveStats(tribute).brains;

            const retained = effectiveBrains >= retentionBrainsMinimum;

            if (retained) {
              selectedResult =
                hiddenType === "hallucinogenic"
                  ? results.hallucinogenicRetained
                  : results.poisonousRetained;
            } else {
              selectedResult = results.harmfulLeftBehind;
            }

            text = createIdentifiedHarmfulForageText(
              tribute,
              forageLabel,
              hiddenType,
              guidebook,
              retained,
            );
          }

          const resolution = resolveResult(selectedResult, context, text);

          const guidebookChanges = guidebook
            ? createSelectedRoleItemUseChanges(context, roleId, id)
            : [];

          return {
            ...resolution,

            changes: [...resolution.changes, ...guidebookChanges],
          };
        },

        {
          possibleResults: [
            results.safe,

            results.hallucinogenicConsumed,

            results.poisonousConsumed,

            results.hallucinogenicRetained,

            results.poisonousRetained,

            results.harmfulLeftBehind,
          ],
        },
      ),
    );
}
