import { getCombatScore } from "~/game/engine/stat-formulas";
import type { EventSelectionContext } from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { areTributesInSameTruce } from "~/game/truces/truce-engine";
import type { GameTribute, InventoryItem } from "~/game/types/game-state";

export const MINIMUM_THEFT_COMBAT_ADVANTAGE = 0.5;

const MINIMUM_THEFT_WEIGHT = 0.1;

function itemHasRemainingUses(item: InventoryItem): boolean {
  return item.usesRemaining === null || item.usesRemaining > 0;
}

function getUsableOwnedItems(tribute: GameTribute): InventoryItem[] {
  return tribute.inventory.filter(itemHasRemainingUses);
}

/**
 * Estimates an item's strategic usefulness from the same
 * bonuses and treatment capabilities used by the game.
 *
 * Limited-use items become less valuable as their remaining
 * uses decline.
 */
function getItemStrategicValue(item: InventoryItem): number {
  const definition = getItemDefinition(item.definitionId);

  const passiveBonusValue =
    (definition.combatBonus ?? 0) +
    (definition.survivalBonus ?? 0) +
    (definition.awarenessBonus ?? 0) +
    (definition.foragingBonus ?? 0);

  const treatmentValue = (definition.treatments ?? []).reduce(
    (total, treatment) =>
      total +
      treatment.severityReduction * 0.08 +
      treatment.durationReduction * 0.08 +
      treatment.priority * 0.02,

    0,
  );

  const remainingUseRatio =
    item.usesRemaining === null
      ? 1
      : Math.min(
          1,

          Math.max(
            0,

            item.usesRemaining / Math.max(1, definition.maxUses ?? item.usesRemaining),
          ),
        );

  return (1 + passiveBonusValue + treatmentValue) * remainingUseRatio;
}

function getOwnedInventoryStrategicValue(tribute: GameTribute): number {
  return getUsableOwnedItems(tribute).reduce(
    (total, item) => total + getItemStrategicValue(item),

    0,
  );
}

function getUsableOwnedItemDefinitionIds(tribute: GameTribute): Set<ItemDefinitionId> {
  return new Set(getUsableOwnedItems(tribute).map((item) => item.definitionId));
}

export function isMeaningfullyStrongerTheftTarget(
  target: GameTribute,
  thief: GameTribute,
): boolean {
  return getCombatScore(target) >= getCombatScore(thief) + MINIMUM_THEFT_COMBAT_ADVANTAGE;
}

interface TheftOpportunity {
  targetCount: number;
  novelItemTypeCount: number;
}

function getTheftOpportunity(thief: GameTribute, context: EventSelectionContext): TheftOpportunity {
  const thiefItemDefinitionIds = getUsableOwnedItemDefinitionIds(thief);

  const novelItemDefinitionIds = new Set<ItemDefinitionId>();

  let targetCount = 0;

  for (const target of context.livingTributes) {
    if (target.id === thief.id) {
      continue;
    }

    if (areTributesInSameTruce(context.state, thief.id, target.id)) {
      continue;
    }

    if (!isMeaningfullyStrongerTheftTarget(target, thief)) {
      continue;
    }

    const targetItems = getUsableOwnedItems(target);

    if (targetItems.length === 0) {
      continue;
    }

    targetCount += 1;

    for (const item of targetItems) {
      if (!thiefItemDefinitionIds.has(item.definitionId)) {
        novelItemDefinitionIds.add(item.definitionId);
      }
    }
  }

  return {
    targetCount,

    novelItemTypeCount: novelItemDefinitionIds.size,
  };
}

/**
 * Favours intelligent, lucky tributes who have a reason to
 * avoid direct combat and who would benefit from more gear.
 */
export function getTheftThiefWeight(thief: GameTribute, context: EventSelectionContext): number {
  const { brains, luck } = thief.snapshot.stats;

  const combatScore = getCombatScore(thief);

  const inventoryValue = getOwnedInventoryStrategicValue(thief);

  const { targetCount, novelItemTypeCount } = getTheftOpportunity(thief, context);

  const aptitudeFactor = 1 + brains * 0.35 + luck * 0.25;

  /*
   * Low and moderate combat scores receive no penalty.
   * Strong direct fighters become progressively less likely
   * to choose theft over confrontation.
   */
  const combatAlternativeFactor = 1 / (1 + Math.max(0, combatScore - 2.5) * 0.25);

  /*
   * A tribute with substantial useful inventory has less
   * strategic need to risk stealing more.
   */
  const inventoryNeedFactor = 1 / (1 + inventoryValue * 0.18);

  /*
   * Cap opportunity bonuses so a Full Game does not make
   * every thief dramatically more likely solely because
   * more tributes exist.
   */
  const opportunityFactor =
    0.75 + Math.min(0.5, targetCount * 0.08) + Math.min(0.75, novelItemTypeCount * 0.15);

  return Math.max(
    MINIMUM_THEFT_WEIGHT,

    aptitudeFactor * combatAlternativeFactor * inventoryNeedFactor * opportunityFactor,
  );
}

/**
 * Favours intimidating targets carrying worthwhile personal
 * inventory, especially items the thief does not possess.
 */
export function getTheftTargetWeight(target: GameTribute, thief: GameTribute): number {
  const targetItems = getUsableOwnedItems(target);

  const thiefItemDefinitionIds = getUsableOwnedItemDefinitionIds(thief);

  const novelItemTypeCount = new Set(
    targetItems
      .filter((item) => !thiefItemDefinitionIds.has(item.definitionId))
      .map((item) => item.definitionId),
  ).size;

  const targetCombatScore = getCombatScore(target);

  const strengthAdvantage = Math.max(
    0,

    targetCombatScore - getCombatScore(thief),
  );

  const inventoryValue = getOwnedInventoryStrategicValue(target);

  const combatFactor = 1 + targetCombatScore * 0.2;

  const strengthAdvantageFactor = 1 + strengthAdvantage * 0.35;

  const inventoryFactor = 1 + targetItems.length * 0.2 + inventoryValue * 0.12;

  const noveltyFactor = 1 + novelItemTypeCount * 0.25;

  return Math.max(
    MINIMUM_THEFT_WEIGHT,

    combatFactor * strengthAdvantageFactor * inventoryFactor * noveltyFactor,
  );
}
