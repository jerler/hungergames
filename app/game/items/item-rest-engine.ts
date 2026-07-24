import { getEffectiveStats } from "~/game/engine/effective-stats";
import type { RandomSource } from "~/game/engine/random";
import { createItemUseChange, createStatusChange } from "~/game/events/event-change-builders";
import {
  isSuccessfulStatCheckOutcome,
  resolveStatCheck,
  type EventStat,
  type StatCheckOutcome,
} from "~/game/events/event-outcomes";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { getItemUsability } from "~/game/items/item-usability";
import type { ItemRestCheckStat } from "~/game/items/item-schema";
import type { NightRestQuality } from "~/game/survival/survival-schema";
import type {
  GameChange,
  GameTribute,
  InventoryItem,
  RoundReference,
} from "~/game/types/game-state";

export interface CompileItemRestChangesOptions {
  eventId: string;
  round: RoundReference;
  random: RandomSource;

  actingTribute: GameTribute;
  owner: GameTribute;
  item: InventoryItem;

  reason?: string;
}

export interface ItemRestResolution {
  outcome: StatCheckOutcome | null;
  quality: NightRestQuality;
  changes: GameChange[];
}

function getRestCheckStat(tribute: GameTribute, configuredStat: ItemRestCheckStat): EventStat {
  if (configuredStat === "brains" || configuredStat === "luck") {
    return configuredStat;
  }

  const { brains, luck } = getEffectiveStats(tribute);

  /*
   * Stable tie-breaking avoids consuming random
   * values merely to decide which stat to check.
   */
  return brains >= luck ? "brains" : "luck";
}

export function resolveItemRestAttempt({
  eventId,
  round,
  random,
  actingTribute,
  owner,
  item,
  reason = eventId,
}: CompileItemRestChangesOptions): ItemRestResolution {
  if (round.period !== "night") {
    throw new Error("Item rest can only be recorded during a night round.");
  }

  const definition = getItemDefinition(item.definitionId);

  const rest = definition.rest;

  if (!rest) {
    throw new Error(`Item "${definition.id}" does not define a rest capability.`);
  }

  const usability = getItemUsability(actingTribute, item);

  if (!usability.usable) {
    throw new Error(
      `${actingTribute.snapshot.name} cannot use ` +
        `"${definition.id}" to rest: ` +
        usability.reasons.join(" "),
    );
  }

  const outcome = rest.check
    ? resolveStatCheck({
        stats: getEffectiveStats(actingTribute),

        stat: getRestCheckStat(actingTribute, rest.check.stat),

        difficulty: rest.check.difficulty,

        random,
      })
    : null;

  const quality =
    outcome === null || isSuccessfulStatCheckOutcome(outcome) ? rest.quality : "unsheltered";

  const changes: GameChange[] = [
    {
      type: "record-night-rest",

      tributeId: actingTribute.id,

      round: {
        ...round,
      },

      quality,
    },
  ];

  if (outcome === "critical-failure" && rest.check?.criticalFailureStatus) {
    const status = rest.check.criticalFailureStatus;

    changes.push(
      createStatusChange(
        eventId,
        actingTribute,

        status.statusId,
        status.severity,

        round,

        status.durationRounds,
      ),
    );
  }

  changes.push(createItemUseChange(owner, item, reason));

  return {
    outcome,
    quality,
    changes,
  };
}

export function compileItemRestChanges(options: CompileItemRestChangesOptions): GameChange[] {
  return resolveItemRestAttempt(options).changes;
}
