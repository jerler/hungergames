import { selectRandomItem } from "~/game/engine/random";
import { getAwarenessScore, getCombatScore } from "~/game/engine/stat-formulas";
import {
  getTheftTargetWeight,
  getTheftThiefWeight,
  isMeaningfullyStrongerTheftTarget,
} from "~/game/engine/theft-formulas";
import {
  createFatalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  clampStatCheckDifficulty,
  getItemLabel,
  resolveLuckAdjustedStatCheck,
} from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
  type EventResolutionContext,
  type ParticipantSelectionContext,
} from "~/game/events/event-schema";
import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameChange, GameTribute, InventoryItem } from "~/game/types/game-state";
import type { TributeStatValue } from "~/game/types/tribute";
import { getTributePronouns } from "~/game/tributes/pronouns";
import { isItemUsableBy } from "~/game/items/item-usability";

const THEFT_EVENT_ID = "steal-from-stronger-tribute";

const STEALABLE_ITEM_DEFINITION_IDS: readonly ItemDefinitionId[] = ITEM_CATALOGUE.map(
  (definition) => definition.id,
);

function requireSelectedThief(context: ParticipantSelectionContext): GameTribute {
  const thief = context.participantsByRole.thief?.[0];

  if (!thief) {
    throw new Error("The theft target role requires a thief to be selected first.");
  }

  return thief;
}

function isEligibleTheftTarget(target: GameTribute, context: ParticipantSelectionContext): boolean {
  return isMeaningfullyStrongerTheftTarget(target, requireSelectedThief(context));
}

function getTheftTargetSelectionWeight(
  target: GameTribute,
  context: ParticipantSelectionContext,
): number {
  return getTheftTargetWeight(target, requireSelectedThief(context));
}

/**
 * The target's awareness matters most, because noticing the
 * attempt is their first defence. Combat strength contributes
 * to their ability to stop the thief after noticing them.
 */
export function getTheftDifficulty(
  target: GameTribute,
  round?: EventResolutionContext["round"],
): TributeStatValue {
  return clampStatCheckDifficulty(
    1 + getAwarenessScore(target, round) * 0.5 + getCombatScore(target) * 0.25,
  );
}

function itemHasRemainingUses(item: InventoryItem): boolean {
  return item.usesRemaining === null || item.usesRemaining > 0;
}

/**
 * Returns the target-owned item reserved during participant
 * selection.
 *
 * Direct resolver unit tests may omit itemsByRole, so the
 * fallback still searches only the target's own inventory.
 */
function requireTheftTargetItem(
  context: EventResolutionContext,
  thief: GameTribute,
  target: GameTribute,
): InventoryItem {
  const selectedItem = context.itemsByRole?.target?.find(
    (selection) => selection.userTributeId === target.id,
  );

  if (selectedItem) {
    if (selectedItem.owner.id !== target.id) {
      throw new Error(
        `Theft target "${target.id}" ` +
          "selected an item owned by " +
          `"${selectedItem.owner.id}".`,
      );
    }

    if (!isItemUsableBy(thief, selectedItem.item)) {
      throw new Error(
        `Theft target "${target.id}" ` +
          "selected an item that is not " +
          `usable by thief "${thief.id}".`,
      );
    }

    return selectedItem.item;
  }

  const fallbackItem =
    target.inventory.find(
      (item) =>
        STEALABLE_ITEM_DEFINITION_IDS.includes(item.definitionId) &&
        itemHasRemainingUses(item) &&
        !context.unavailableItemInstanceIds?.has(item.id) &&
        isItemUsableBy(thief, item),
    ) ?? null;

  if (!fallbackItem) {
    throw new Error(
      `Theft target "${target.id}" ` +
        "does not personally own an " +
        "unreserved item usable by " +
        `thief "${thief.id}".`,
    );
  }

  return fallbackItem;
}

function getSelectedTheftSlingshot(
  context: EventResolutionContext,
  thief: GameTribute,
): InventoryItem | null {
  const selection = context.itemsByRole?.thief?.find(
    (candidate) =>
      candidate.userTributeId === thief.id && candidate.item.definitionId === "slingshot",
  );

  return selection?.item ?? null;
}

function findAdditionalTheftItem(
  context: EventResolutionContext,
  thief: GameTribute,
  target: GameTribute,
  primaryItem: InventoryItem,
): InventoryItem | null {
  const candidates = target.inventory.filter(
    (item) =>
      item.id !== primaryItem.id &&
      itemHasRemainingUses(item) &&
      isItemUsableBy(thief, item) &&
      !context.unavailableItemInstanceIds?.has(item.id),
  );

  if (candidates.length === 0) {
    return null;
  }

  return selectRandomItem(candidates, context.random);
}

function createTheftTransfer(
  item: InventoryItem,
  target: GameTribute,
  thief: GameTribute,
): GameChange {
  return {
    type: "transfer-item",

    itemInstanceId: item.id,

    fromTributeId: target.id,
    toTributeId: thief.id,

    reason: "theft",
  };
}

function formatStolenItems(items: readonly InventoryItem[]): string {
  return items.map((item) => getItemLabel(item.definitionId)).join(" and ");
}

export const STEAL_FROM_STRONGER_TRIBUTE_EVENT = {
  id: THEFT_EVENT_ID,

  category: "hazard",

  tags: ["hazard", "item"],

  periods: ["day", "night"],

  /*
   * Theft should appear occasionally without competing with
   * the catalogue's more common survival and hazard events.
   */
  baseWeight: 1.5,

  roles: [
    {
      id: "thief",
      count: 1,

      optionalItemDefinitionIds: ["slingshot"],

      optionalItemAccess: "accessible",

      getWeight: getTheftThiefWeight,
    },

    {
      id: "target",
      count: 1,

      targeting: "hostile",

      opposesRoleIds: ["thief"],

      itemAccess: "owned",
      requiredItemDefinitionIds: STEALABLE_ITEM_DEFINITION_IDS,
      requiredItemUsableByRoleId: "thief",

      isEligible: isEligibleTheftTarget,
      getWeight: getTheftTargetSelectionWeight,
    },
  ],

  isEligible: ({ livingTributes }) => livingTributes.length >= 2,

  resolve(context): EventResolution {
    const { eventId, round, random, participantsByRole } = context;

    const thief = requireSingleParticipant(participantsByRole, "thief");
    const thiefPronouns = getTributePronouns(thief);

    const target = requireSingleParticipant(participantsByRole, "target");

    const slingshot = getSelectedTheftSlingshot(context, thief);
    const primaryItem = requireTheftTargetItem(context, thief, target);

    const primaryItemLabel = getItemLabel(primaryItem.definitionId);

    const outcome = resolveLuckAdjustedStatCheck(
      thief,
      "brains",
      getTheftDifficulty(target, context.round),
      random,
      slingshot ? 1 : 0,
    );

    switch (outcome) {
      case "critical-failure": {
        const text =
          `${target.snapshot.name} catches ` +
          `${thief.snapshot.name} reaching for ` +
          `the ${primaryItemLabel} and kills ` +
          `${thief.snapshot.name}.`;

        /*
         * Do not emit a theft transfer here.
         *
         * createFatalChanges first eliminates the thief,
         * then awards killer statistics and transfers the
         * thief's existing inventory as death loot.
         */
        return {
          text,

          changes: createFatalChanges(
            thief,
            THEFT_EVENT_ID,
            "Killed during a failed theft",
            text,
            target,
          ),
        };
      }

      case "failure": {
        const text = slingshot
          ? `${thief.snapshot.name} fires a ` +
            `stone into the trees and draws ` +
            `${target.snapshot.name} away, ` +
            "but the distraction ends before " +
            `${thief.snapshot.name} can escape ` +
            `with the ${primaryItemLabel}. ` +
            `${target.snapshot.name} begins ` +
            `hunting ${thiefPronouns.object}.`
          : `${target.snapshot.name} catches ` +
            `${thief.snapshot.name} trying to ` +
            `steal the ${primaryItemLabel}. ` +
            `${thief.snapshot.name} escapes, ` +
            `but ${target.snapshot.name} begins ` +
            `hunting ${thiefPronouns.object}.`;

        return {
          text,

          changes: [createStatusChange(eventId, thief, "hunted", 1, round)],
        };
      }

      case "success": {
        const text = slingshot
          ? `${thief.snapshot.name} fires a ` +
            `stone into the trees and draws ` +
            `${target.snapshot.name} away, ` +
            "but the distraction ends before " +
            `${thief.snapshot.name} can escape ` +
            `with the ${primaryItemLabel}. ` +
            `${target.snapshot.name} begins ` +
            `hunting ${thiefPronouns.object}.`
          : `${target.snapshot.name} catches ` +
            `${thief.snapshot.name} trying to ` +
            `steal the ${primaryItemLabel}. ` +
            `${thief.snapshot.name} escapes, ` +
            `but ${target.snapshot.name} begins ` +
            `hunting ${thiefPronouns.object}.`;

        return {
          text,

          changes: [
            createTheftTransfer(primaryItem, target, thief),

            ...createSurvivalChanges([thief]),
          ],
        };
      }

      case "exceptional-success": {
        const additionalItem = findAdditionalTheftItem(context, thief, target, primaryItem);

        const stolenItems = additionalItem ? [primaryItem, additionalItem] : [primaryItem];

        const text = slingshot
          ? stolenItems.length === 2
            ? `${thief.snapshot.name} creates ` +
              "a perfect diversion with the " +
              `slingshot and steals ` +
              `${formatStolenItems(stolenItems)} ` +
              `from ${target.snapshot.name}.`
            : `${thief.snapshot.name} creates ` +
              "a perfect diversion with the " +
              `slingshot and steals the ` +
              `${primaryItemLabel} from ` +
              `${target.snapshot.name}.`
          : stolenItems.length === 2
            ? `${thief.snapshot.name} slips past ` +
              `${target.snapshot.name} and steals ` +
              `${formatStolenItems(stolenItems)} ` +
              "without leaving a trace."
            : `${thief.snapshot.name} steals ` +
              `the ${primaryItemLabel} from ` +
              `${target.snapshot.name} without ` +
              "leaving a trace.";

        return {
          text,

          changes: [
            ...stolenItems.map((item) => createTheftTransfer(item, target, thief)),

            ...createSurvivalChanges([thief]),
          ],
        };
      }
    }
  },
} satisfies EventDefinition;

export const THEFT_EVENTS = [
  STEAL_FROM_STRONGER_TRIBUTE_EVENT,
] satisfies readonly EventDefinition[];
