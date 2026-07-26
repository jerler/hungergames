import { getEffectiveStats } from "~/game/engine/effective-stats";
import { selectRandomItem, type RandomSource } from "~/game/engine/random";
import { getAwarenessScore } from "~/game/engine/stat-formulas";
import { resolveScoreCheck } from "~/game/events/event-outcomes";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { getItemLabel, resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import {
  hasUsableCornucopiaPackItem,
  selectCornucopiaPackItem,
  selectDistinctCornucopiaPackItems,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import { isItemDefinitionUsableBy } from "~/game/items/item-usability";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import type { GameTribute } from "~/game/types/game-state";
import { getTributePronouns } from "~/game/tributes/pronouns";

const CORNUCOPIA_SWORD_ITEM_IDS = [
  "short-sword",
  "rapier",
  "longsword",
  "greatsword",
] as const satisfies readonly ItemDefinitionId[];

interface AcquisitionVariantOptions {
  id: string;
  baseWeight: number;
  tags: EventDefinition["tags"];
  isEligible: (tribute: GameTribute) => boolean;
  selectItemIds: (tribute: GameTribute, random: RandomSource) => readonly ItemDefinitionId[];
  getText: (tribute: GameTribute, itemIds: readonly ItemDefinitionId[]) => string;
}

function hasUsableItem(tribute: GameTribute, itemId: ItemDefinitionId): boolean {
  return isItemDefinitionUsableBy(tribute, itemId);
}

function hasUsableItems(tribute: GameTribute, itemIds: readonly ItemDefinitionId[]): boolean {
  return itemIds.every((itemId) => hasUsableItem(tribute, itemId));
}

function getUsableItems(
  tribute: GameTribute,
  itemIds: readonly ItemDefinitionId[],
): ItemDefinitionId[] {
  return itemIds.filter((itemId) => hasUsableItem(tribute, itemId));
}

function formatIndefiniteItemLabel(itemId: ItemDefinitionId): string {
  const label = getItemLabel(itemId);
  const article = /^[aeiou]/i.test(label) ? "an" : "a";

  return `${article} ${label}`;
}

function createAcquisitionVariant({
  id,
  baseWeight,
  tags,
  isEligible,
  selectItemIds,
  getText,
}: AcquisitionVariantOptions): EventDefinition {
  return {
    id,
    category: "hazard",
    tags,
    periods: ["day"],
    baseWeight,
    roles: [
      {
        id: "tribute",
        count: 1,
        isEligible,
      },
    ],
    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const itemIds = selectItemIds(tribute, random);

      if (itemIds.length === 0) {
        throw new Error(`Event "${id}" could not select an item.`);
      }

      return {
        text: getText(tribute, itemIds),
        changes: createItemAcquisitionAndSurvivalChanges(
          eventId,
          tribute,
          itemIds,
          round,
          "cornucopia",
        ),
      };
    },
  };
}

const BOW_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-bow",
  baseWeight: 1.4,
  tags: ["hazard", "combat", "weapon", "item"],
  isEligible: (tribute) => hasUsableItem(tribute, "bow"),
  selectItemIds: () => ["bow"],
  getText: (tribute) =>
    `${tribute.snapshot.name} spots a bow beneath a tangle of supply packs, ` +
    "tears it free with the quiver still attached, and runs.",
});

const SPEAR_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-spear",
  baseWeight: 1.2,
  tags: ["hazard", "combat", "weapon", "item"],
  isEligible: (tribute) => hasUsableItem(tribute, "spear"),
  selectItemIds: () => ["spear"],
  getText: (tribute) =>
    `${tribute.snapshot.name} reaches into the Cornucopia, closes a hand around ` +
    "a spear, and backs away before anyone can contest it.",
});

const TRIDENT_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-trident",
  baseWeight: 0.8,
  tags: ["hazard", "combat", "weapon", "item"],
  isEligible: (tribute) => hasUsableItem(tribute, "trident"),
  selectItemIds: () => ["trident"],
  getText: (tribute) =>
    `${tribute.snapshot.name} climbs over a heap of abandoned supplies looking ` +
    "for the coolest weapon and spots a golden trident poking from the pile. " +
    `${tribute.snapshot.name} pushes past several other weapons, grabs it, and runs.`,
});

const SHIELD_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-shield",
  baseWeight: 1,
  tags: ["hazard", "combat", "item"],
  isEligible: (tribute) => hasUsableItem(tribute, "shield"),
  selectItemIds: () => ["shield"],
  getText: (tribute) => {
    const pronouns = getTributePronouns(tribute);

    return (
      `${tribute.snapshot.name} decides a good defence is better than any offence, ` +
      "yanks a shield from the side of the Cornucopia, and raises it just in time " +
      `to block an arrow shot in ${pronouns.possessiveAdjective} direction.`
    );
  },
});

const SWORD_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-sword",
  baseWeight: 1.4,
  tags: ["hazard", "combat", "weapon", "item"],
  isEligible: (tribute) => getUsableItems(tribute, CORNUCOPIA_SWORD_ITEM_IDS).length > 0,
  selectItemIds: (tribute, random) => [
    selectRandomItem(getUsableItems(tribute, CORNUCOPIA_SWORD_ITEM_IDS), random),
  ],
  getText: (tribute, [itemId]) => {
    if (!itemId) {
      throw new Error("Sword acquisition did not select a sword.");
    }

    return (
      `${tribute.snapshot.name} grabs ${formatIndefiniteItemLabel(itemId)} by the hilt, ` +
      "yanks it free from the boxes, and brandishes it at the other tributes."
    );
  },
});

const MED_KIT_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-med-kit",
  baseWeight: 0.7,
  tags: ["hazard", "item", "resource"],
  isEligible: (tribute) => hasUsableItem(tribute, "med-kit"),
  selectItemIds: () => ["med-kit"],
  getText: (tribute) => {
    const pronouns = getTributePronouns(tribute);

    return (
      `${tribute.snapshot.name} clutches a med kit to ${pronouns.possessiveAdjective} ` +
      "chest and sprints from the Cornucopia without looking back."
    );
  },
});

const CAMPING_EQUIPMENT_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-camping-equipment",
  baseWeight: 0.6,
  tags: ["hazard", "item", "resource"],
  isEligible: (tribute) => hasUsableItems(tribute, ["tent", "lighter"]),
  selectItemIds: () => ["tent", "lighter"],
  getText: (tribute) =>
    `${tribute.snapshot.name} escapes with a tent and a lighter, carrying enough ` +
    "camping equipment to last for several days hiding in the woods.",
});

const FIREBOMB_ACQUISITION_EVENT = createAcquisitionVariant({
  id: "cornucopia-flavour-firebomb",
  baseWeight: 0.6,
  tags: ["hazard", "combat", "weapon", "item"],
  isEligible: (tribute) => hasUsableItem(tribute, "firebomb"),
  selectItemIds: () => ["firebomb"],
  getText: (tribute) =>
    `${tribute.snapshot.name} snatches a cherry bomb from an open pack, ` +
    "immediately becomes concerned by how loosely it was packed, and retreats.",
});

const EMPTY_FJALLRAVEN_EVENT: EventDefinition = {
  id: "cornucopia-empty-fjallraven-pack",
  category: "survival",
  tags: ["survival", "resource"],
  periods: ["day"],
  baseWeight: 1,
  roles: [
    {
      id: "tribute",
      count: 1,
    },
  ],
  resolve({ participantsByRole }): EventResolution {
    const tribute = requireSingleParticipant(participantsByRole, "tribute");

    return {
      text:
        `${tribute.snapshot.name} spots a heavy-looking backpack beside a beautiful ` +
        `Fjällräven bag. ${tribute.snapshot.name} grabs the Fjällräven and runs, ` +
        "only to discover that it contains absolutely nothing.",
      changes: createSurvivalChanges([tribute]),
    };
  },
};

const HIDE_INSIDE_CORNUCOPIA_EVENT: EventDefinition = {
  id: "cornucopia-hide-inside",
  category: "hazard",
  tags: ["hazard", "survival"],
  periods: ["day"],
  baseWeight: 1.3,
  roles: [
    {
      id: "tribute",
      count: 1,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const tribute = requireSingleParticipant(participantsByRole, "tribute");
    const effectiveStats = getEffectiveStats(tribute);
    const score = (effectiveStats.brains + getAwarenessScore(tribute, round)) / 2;
    const outcome = resolveScoreCheck({ score, difficulty: 3, random });

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${tribute.snapshot.name} gets scared by the chaos and dives into the ` +
            "Cornucopia to hide, only to become lost in a sea of supply crates and carnage.",
          changes: [
            createStatusChange(eventId, tribute, "disoriented", 1, round),
            ...createSurvivalChanges([tribute]),
          ],
        };

      case "failure":
        return {
          text:
            `${tribute.snapshot.name} gets pushed aside while running toward a box, ` +
            "falls into the sea of supplies, and gets stuck.",
          changes: createSurvivalChanges([tribute]),
        };

      case "success":
        return {
          text:
            `${tribute.snapshot.name} gets scared by the chaos and dives into the ` +
            "Cornucopia to hide, successfully wrapping " +
            `${getTributePronouns(tribute).reflexive} in tarps to wait for ` +
            "the chaos to stop.",
          changes: [
            createStatusChange(eventId, tribute, "hidden", 1, round),
            ...createSurvivalChanges([tribute]),
          ],
        };

      case "exceptional-success":
        return {
          text:
            `${tribute.snapshot.name} quickly finds a hiding spot inside an empty ` +
            "supply crate within the Cornucopia and watches the Bloodbath unfold " +
            "without being seen.",
          changes: [
            createStatusChange(eventId, tribute, "hidden", 1, round),
            createStatusChange(eventId, tribute, "alert", 1, round),
            ...createSurvivalChanges([tribute]),
          ],
        };
    }
  },
};

const STAY_FOR_MORE_RESOURCES_EVENT: EventDefinition = {
  id: "cornucopia-stay-for-more-resources",
  category: "hazard",
  tags: ["hazard", "item", "resource"],
  periods: ["day"],
  baseWeight: 1.5,
  roles: [
    {
      id: "tribute",
      count: 1,
      isEligible: hasUsableCornucopiaPackItem,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const tribute = requireSingleParticipant(participantsByRole, "tribute");
    const effectiveStats = getEffectiveStats(tribute);
    const score = (effectiveStats.luck + getAwarenessScore(tribute, round)) / 2;
    const outcome = resolveScoreCheck({ score, difficulty: 3, random });

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${tribute.snapshot.name} confidently gathers several supply packs before ` +
            "getting hit with a metal chair and knocked unconscious. When " +
            `${tribute.snapshot.name} wakes, the supplies are gone, but ` +
            `${getTributePronouns(tribute).subject} ${getTributePronouns(tribute).bePresent} ` +
            "lucky to be alive.",
          changes: [
            createStatusChange(eventId, tribute, "injured", 2, round),
            ...createSurvivalChanges([tribute]),
          ],
        };

      case "failure":
        return {
          text:
            `${tribute.snapshot.name} searches the outer piles until the fighting comes ` +
            "too close, then retreats with only the provisions already gathered.",
          changes: createSurvivalChanges([tribute]),
        };

      case "success": {
        const itemId = selectCornucopiaPackItem(tribute, random);

        return {
          text:
            `${tribute.snapshot.name} quickly grabs the first bag ` +
            `${getTributePronouns(tribute).subject} can see and sprints away from the ` +
            `Cornucopia before the fighting reaches ${getTributePronouns(tribute).object}.`,
          changes: createItemAcquisitionAndSurvivalChanges(
            eventId,
            tribute,
            [itemId],
            round,
            "cornucopia",
          ),
        };
      }

      case "exceptional-success": {
        const itemIds = selectDistinctCornucopiaPackItems(tribute, 2, random);
        const [firstItemId, secondItemId] = itemIds;

        if (!firstItemId || !secondItemId) {
          throw new Error("Exceptional resource search could not select two items.");
        }

        return {
          text:
            `${tribute.snapshot.name} studies the chaos of the Cornucopia, predicts the ` +
            `other tributes' movements perfectly, and gathers ${getItemLabel(firstItemId)} ` +
            `and ${getItemLabel(secondItemId)} before slipping away untouched.`,
          changes: createItemAcquisitionAndSurvivalChanges(
            eventId,
            tribute,
            itemIds,
            round,
            "cornucopia",
          ),
        };
      }
    }
  },
};

const GATHER_FOOD_EVENT: EventDefinition = {
  id: "cornucopia-gather-food",
  category: "survival",
  tags: ["survival", "resource"],
  periods: ["day"],
  baseWeight: 1.5,
  roles: [
    {
      id: "tribute",
      count: 1,
    },
  ],
  resolve({ eventId, round, random, participantsByRole }): EventResolution {
    const tribute = requireSingleParticipant(participantsByRole, "tribute");
    const outcome = resolveLuckAdjustedStatCheck(tribute, "luck", 3, random);

    switch (outcome) {
      case "critical-failure":
        return {
          text:
            `${tribute.snapshot.name} gathers an armful of food, trips while escaping, ` +
            "and watches most of it scatter beneath the other tributes' feet.",
          changes: createSurvivalChanges([tribute]),
        };

      case "failure":
        return {
          text:
            `${tribute.snapshot.name} grabs all the food ` +
            `${getTributePronouns(tribute).subject} can carry and runs, leaving every ` +
            "other useful supply behind.",
          changes: createSurvivalChanges([tribute]),
        };

      case "success":
        return {
          text:
            `${tribute.snapshot.name} quickly stuffs food into a supply pack and runs ` +
            `before any fighting can reach ${getTributePronouns(tribute).object}.`,
          changes: createSurvivalChanges([tribute]),
        };

      case "exceptional-success":
        return {
          text:
            `${tribute.snapshot.name} finds a beautiful Costco rotisserie chicken ` +
            "sitting atop a backpack filled with food and supplies, grabs it, and runs " +
            "into the woods.",
          changes: [
            createStatusChange(eventId, tribute, "well-fed", 1, round),
            ...createSurvivalChanges([tribute]),
          ],
        };
    }
  },
};

export const CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS = [
  BOW_ACQUISITION_EVENT,
  SPEAR_ACQUISITION_EVENT,
  TRIDENT_ACQUISITION_EVENT,
  SHIELD_ACQUISITION_EVENT,
  SWORD_ACQUISITION_EVENT,
  MED_KIT_ACQUISITION_EVENT,
  CAMPING_EQUIPMENT_ACQUISITION_EVENT,
  FIREBOMB_ACQUISITION_EVENT,
  EMPTY_FJALLRAVEN_EVENT,
  HIDE_INSIDE_CORNUCOPIA_EVENT,
  STAY_FOR_MORE_RESOURCES_EVENT,
  GATHER_FOOD_EVENT,
] satisfies readonly EventDefinition[];
