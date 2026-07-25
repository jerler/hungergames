import type { RandomSource } from "~/game/engine/random";

import { createItemUseChange, createStatusChange } from "~/game/events/event-change-builders";

import type { StatCheckOutcome } from "~/game/events/event-outcomes";

import { resolveLuckAdjustedBestStatCheck } from "~/game/events/event-resolution-helpers";

import {
  getAccessibleInventoryItems,
  type AccessibleInventoryItem,
} from "~/game/items/inventory-engine";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { StatusEffectId } from "~/game/statuses/status-schema";

import type { GameChange, GameState, GameTribute, RoundReference } from "~/game/types/game-state";

import type { TributeStatValue } from "~/game/types/tribute";

export type CamouflagePreparationItemId = "camouflage-net" | "camouflage-paint";

interface CamouflagePreparationConfig {
  difficulty: TributeStatValue;

  hiddenSeverity: 1 | 2 | 3;

  priority: number;
}

const CAMOUFLAGE_PREPARATION_CONFIG = {
  "camouflage-net": {
    difficulty: 2,
    hiddenSeverity: 2,
    priority: 0,
  },

  "camouflage-paint": {
    difficulty: 3,
    hiddenSeverity: 1,
    priority: 1,
  },
} as const satisfies Record<CamouflagePreparationItemId, CamouflagePreparationConfig>;

export interface CamouflagePreparationPlan {
  selection: AccessibleInventoryItem;

  itemId: CamouflagePreparationItemId;

  difficulty: TributeStatValue;

  hiddenSeverity: 1 | 2 | 3;

  priority: number;
}

export interface CamouflagePreparationAttempt {
  outcome: StatCheckOutcome;

  changes: GameChange[];

  affectedStatusIds: StatusEffectId[];
}

function getCamouflageConfig(itemId: ItemDefinitionId):
  | ({
      itemId: CamouflagePreparationItemId;
    } & CamouflagePreparationConfig)
  | null {
  switch (itemId) {
    case "camouflage-net":
    case "camouflage-paint":
      return {
        itemId,

        ...CAMOUFLAGE_PREPARATION_CONFIG[itemId],
      };

    default:
      return null;
  }
}

function isAlreadyHidden(tribute: GameTribute): boolean {
  return tribute.statuses.some((status) => status.definitionId === "hidden");
}

function compareCamouflagePlans(
  tribute: GameTribute,
  first: CamouflagePreparationPlan,
  second: CamouflagePreparationPlan,
): number {
  return (
    Number(first.selection.owner.id !== tribute.id) -
      Number(second.selection.owner.id !== tribute.id) ||
    first.priority - second.priority ||
    first.selection.item.id.localeCompare(second.selection.item.id)
  );
}

export function findCamouflagePreparationPlan(
  state: GameState,
  tribute: GameTribute,
  unavailableItemInstanceIds: ReadonlySet<string> = new Set(),
): CamouflagePreparationPlan | null {
  if (isAlreadyHidden(tribute)) {
    return null;
  }

  const plans = getAccessibleInventoryItems(state, tribute, {
    requiredTags: ["camouflage"],

    unavailableItemInstanceIds,

    requireUsable: true,
  }).flatMap((selection): CamouflagePreparationPlan[] => {
    const config = getCamouflageConfig(selection.item.definitionId);

    if (!config) {
      return [];
    }

    return [
      {
        selection,

        ...config,
      },
    ];
  });

  return plans.sort((first, second) => compareCamouflagePlans(tribute, first, second))[0] ?? null;
}

export function resolveCamouflagePreparationAttempt({
  eventId,
  round,
  random,
  tribute,
  plan,
}: {
  eventId: string;
  round: RoundReference;
  random: RandomSource;
  tribute: GameTribute;
  plan: CamouflagePreparationPlan;
}): CamouflagePreparationAttempt {
  const outcome = resolveLuckAdjustedBestStatCheck(
    tribute,
    ["brains", "luck"],

    plan.difficulty,
    random,
  );

  const changes: GameChange[] = [];

  const affectedStatusIds: StatusEffectId[] = [];

  if (outcome === "critical-failure") {
    changes.push(createStatusChange(eventId, tribute, "disoriented", 1, round));

    affectedStatusIds.push("disoriented");
  } else if (outcome === "success") {
    changes.push(createStatusChange(eventId, tribute, "hidden", plan.hiddenSeverity, round));

    affectedStatusIds.push("hidden");
  } else if (outcome === "exceptional-success") {
    changes.push(createStatusChange(eventId, tribute, "hidden", 3, round));

    affectedStatusIds.push("hidden");
  }

  changes.push(createItemUseChange(plan.selection.owner, plan.selection.item, eventId));

  return {
    outcome,
    changes,
    affectedStatusIds,
  };
}
