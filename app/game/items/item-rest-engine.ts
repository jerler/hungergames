import { getEffectiveStats } from "~/game/engine/effective-stats";
import type { RandomSource } from "~/game/engine/random";
import { createItemUseChange } from "~/game/events/event-change-builders";
import { resolveStatCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { getItemUsability } from "~/game/items/item-usability";
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

function isSuccessfulOutcome(outcome: StatCheckOutcome): boolean {
  return outcome === "success" || outcome === "exceptional-success";
}

export function compileItemRestChanges({
  eventId,
  round,
  random,
  actingTribute,
  owner,
  item,
  reason = eventId,
}: CompileItemRestChangesOptions): GameChange[] {
  if (round.period !== "night") {
    throw new Error(`Item rest can only be recorded during a night round.`);
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

  const quality = rest.check
    ? isSuccessfulOutcome(
        resolveStatCheck({
          stats: getEffectiveStats(actingTribute),
          stat: rest.check.stat,
          difficulty: rest.check.difficulty,
          random,
        }),
      )
      ? rest.quality
      : "unsheltered"
    : rest.quality;

  return [
    {
      type: "record-night-rest",
      tributeId: actingTribute.id,

      round: {
        ...round,
      },

      quality,
    },

    createItemUseChange(owner, item, reason),
  ];
}
