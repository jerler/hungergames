import type {
  ChanceToGrantStatusItemEffect,
  GrantStatusItemEffect,
  ItemDefinition,
  ItemRestCheckStat,
  ItemTag,
} from "~/game/items/item-schema";

import { getItemDefinition } from "~/game/items/item-catalogue";

import { getItemUsability } from "~/game/items/item-usability";

import { MEDICAL_STATUS_IDS, isMedicalStatusId } from "~/game/statuses/medical-statuses";

import { getStatusDefinition } from "~/game/statuses/status-catalogue";

import type { GameTribute, InventoryItem } from "~/game/types/game-state";

import type { TributeStats } from "~/game/types/tribute";

export interface ItemCapabilityGroup {
  label: string;
  details: readonly string[];
}

export interface InventoryItemPresentation {
  label: string;
  description: string;

  usesLabel: string;
  minimumRequirements: readonly string[];

  usable: boolean;
  usabilityLabel: string;
  unusableReasons: readonly string[];

  capabilityGroups: readonly ItemCapabilityGroup[];
}

const STAT_KEYS = ["brains", "brawn", "luck"] as const satisfies readonly (keyof TributeStats)[];

const STAT_LABELS = {
  brains: "Brains",

  brawn: "Brawn",

  luck: "Luck",
} satisfies Record<keyof TributeStats, string>;

const UTILITY_TAG_DETAILS = [
  {
    tag: "hunting",

    detail: "Can be used during hunting events.",
  },

  {
    tag: "fishing",

    detail: "Can be used during fishing events.",
  },

  {
    tag: "camouflage",

    detail: "Can be used during camouflage preparation.",
  },

  {
    tag: "navigation",

    detail: "Supports navigation and awareness activities.",
  },

  {
    tag: "trap",

    detail: "Supports trap-based activities.",
  },

  {
    tag: "fire",

    detail: "Can support a fire-based night camp.",
  },
] as const satisfies readonly {
  tag: ItemTag;
  detail: string;
}[];

function formatList(values: readonly string[]): string {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  const finalValue = values.at(-1) ?? "";

  return `${values.slice(0, -1).join(", ")}, and ${finalValue}`;
}

function formatRoundCount(count: number): string {
  return `${count} ` + (count === 1 ? "round" : "rounds");
}

function formatBonus(value: number): string {
  const roundedValue = Math.round(value * 100) / 100;

  if (roundedValue > 0) {
    return `+${roundedValue}`;
  }

  return String(roundedValue).replace("-", "−");
}

function formatPercentageReduction(multiplier: number): number {
  return Math.round((1 - multiplier) * 100);
}

function createMinimumRequirements(definition: ItemDefinition): string[] {
  const requirements = STAT_KEYS.flatMap((stat) => {
    const minimum = definition.minimumStats?.[stat];

    if (minimum === undefined) {
      return [];
    }

    return [`${STAT_LABELS[stat]} ${minimum}`];
  });

  return requirements.length > 0 ? requirements : ["No minimum stat requirements."];
}

function createUsesLabel(definition: ItemDefinition, item: InventoryItem): string {
  if (item.usesRemaining === null) {
    return "Reusable";
  }

  if (item.usesRemaining <= 0) {
    return "No uses remaining";
  }

  if (definition.maxUses !== undefined && definition.maxUses > 1) {
    return `${item.usesRemaining} of ` + `${definition.maxUses} uses remaining`;
  }

  return `${item.usesRemaining} ` + (item.usesRemaining === 1 ? "use remaining" : "uses remaining");
}

function addCapabilityDetail(
  groups: Map<string, string[]>,

  label: string,
  detail: string,
): void {
  const existingDetails = groups.get(label);

  if (existingDetails) {
    if (!existingDetails.includes(detail)) {
      existingDetails.push(detail);
    }

    return;
  }

  groups.set(label, [detail]);
}

function formatStatusLabels(
  statusIds: readonly Parameters<typeof getStatusDefinition>[0][],
): string {
  return formatList(statusIds.map((statusId) => getStatusDefinition(statusId).label));
}

function getGrantedStatusDuration(
  effect: GrantStatusItemEffect | ChanceToGrantStatusItemEffect,
): number | null {
  if (effect.durationRounds !== undefined) {
    return effect.durationRounds;
  }

  const definition = getStatusDefinition(effect.statusId);

  if (definition.duration.kind === "persistent") {
    return null;
  }

  return definition.duration.defaultRounds;
}

function formatGrantedStatusEffect(
  effect: GrantStatusItemEffect | ChanceToGrantStatusItemEffect,
): string {
  const definition = getStatusDefinition(effect.statusId);

  const severityLabel = definition.kind === "beneficial" ? "strength" : "severity";

  const durationRounds = getGrantedStatusDuration(effect);

  const durationPhrase = durationRounds === null ? "" : ` for ${formatRoundCount(durationRounds)}`;

  const grantPhrase =
    effect.type === "chance-to-grant-status"
      ? `${Math.round(effect.chance * 100)}% chance to grant`
      : "Grants";

  return (
    `${grantPhrase} ` +
    `${definition.label} ` +
    `(${severityLabel} ${effect.severity})` +
    `${durationPhrase}.`
  );
}

function formatRestCheck(stat: ItemRestCheckStat, difficulty: number): string {
  switch (stat) {
    case "brains":
      return "Requires a Brains check " + `at difficulty ${difficulty}.`;

    case "luck":
      return "Requires a Luck check " + `at difficulty ${difficulty}.`;

    case "brains-or-luck":
      return (
        "Requires a check using the better " + "of Brains or Luck at difficulty " + `${difficulty}.`
      );
  }
}

function createUseEffectCapabilities(
  definition: ItemDefinition,
  groups: Map<string, string[]>,
): void {
  for (const effect of definition.useEffects ?? []) {
    switch (effect.type) {
      case "satisfy-need":
        addCapabilityDetail(
          groups,

          "Consumption",

          effect.need === "food" ? "Satisfies hunger." : "Restores hydration.",
        );

        break;

      case "remove-medical-statuses":
        addCapabilityDetail(
          groups,

          "Medical treatment",

          `Treats ${formatStatusLabels(MEDICAL_STATUS_IDS)}.`,
        );

        break;

      case "remove-status": {
        const medicalStatusIds = effect.statusIds.filter(isMedicalStatusId);

        const otherStatusIds = effect.statusIds.filter((statusId) => !isMedicalStatusId(statusId));

        if (medicalStatusIds.length > 0) {
          addCapabilityDetail(
            groups,

            "Medical treatment",

            `Treats ${formatStatusLabels(medicalStatusIds)}.`,
          );
        }

        if (otherStatusIds.length > 0) {
          addCapabilityDetail(
            groups,

            "Recovery",

            `Removes ${formatStatusLabels(otherStatusIds)}.`,
          );
        }

        break;
      }

      case "grant-status":
      case "chance-to-grant-status":
        addCapabilityDetail(
          groups,

          "Status effects",

          formatGrantedStatusEffect(effect),
        );

        break;
    }
  }
}

function createRestCapabilities(definition: ItemDefinition, groups: Map<string, string[]>): void {
  const rest = definition.rest;

  if (!rest) {
    return;
  }

  addCapabilityDetail(
    groups,

    "Rest",

    rest.quality === "comfortable"
      ? "Provides comfortable rest " + "when used at night."
      : "Provides sheltered rest " + "when used at night.",
  );

  if (rest.check) {
    addCapabilityDetail(
      groups,

      "Rest",

      formatRestCheck(rest.check.stat, rest.check.difficulty),
    );
  }

  const criticalFailureStatus = rest.check?.criticalFailureStatus;

  if (criticalFailureStatus) {
    const statusDefinition = getStatusDefinition(criticalFailureStatus.statusId);

    addCapabilityDetail(
      groups,

      "Rest",

      "A critical failure applies " +
        `${statusDefinition.label} ` +
        `(severity ${criticalFailureStatus.severity}).`,
    );
  }
}

function createOffenseCapabilities(
  definition: ItemDefinition,
  groups: Map<string, string[]>,
): void {
  const offense = definition.offense;

  if (!offense) {
    return;
  }

  switch (offense.strategy) {
    case "direct":
      addCapabilityDetail(
        groups,

        "Combat",

        `Adds ${formatBonus(offense.attackBonus)} to direct attack score when usable.`,
      );

      break;

    case "poison":
      addCapabilityDetail(
        groups,

        "Combat",

        "Enables poison attacks.",
      );

      break;

    case "trap":
      addCapabilityDetail(
        groups,

        "Combat",

        "Enables prepared trap attacks.",
      );

      break;

    case "risky-area":
      addCapabilityDetail(
        groups,

        "Combat",

        "Enables risky area attacks that may harm the user on a critical failure.",
      );

      break;
  }
}

function createDefenseCapabilities(
  definition: ItemDefinition,
  groups: Map<string, string[]>,
): void {
  const defense = definition.defense;

  if (!defense) {
    return;
  }

  addCapabilityDetail(
    groups,

    "Defense",

    `Adds ${formatBonus(defense.checkedAttackBonus)} to checked attack defense when usable.`,
  );

  addCapabilityDetail(
    groups,

    "Defense",

    "Reduces ordinary hostile targeting by " +
      `${formatPercentageReduction(defense.hostileTargetWeightMultiplier)}%.`,
  );
}

function createPassiveBonusCapabilities(
  definition: ItemDefinition,
  groups: Map<string, string[]>,
): void {
  const bonuses = [
    {
      label: "Survival",

      value: definition.survivalBonus,
    },

    {
      label: "Awareness",

      value: definition.awarenessBonus,
    },

    {
      label: "Foraging",

      value: definition.foragingBonus,
    },
  ] as const;

  for (const { label, value } of bonuses) {
    if (value === undefined || value === 0) {
      continue;
    }

    addCapabilityDetail(
      groups,

      "Passive bonuses",

      `${formatBonus(value)} ${label.toLowerCase()} score while usable.`,
    );
  }
}

function createContextualCapabilities(
  definition: ItemDefinition,
  groups: Map<string, string[]>,
): void {
  const contextual = definition.contextual;

  if (!contextual) {
    return;
  }

  if (contextual.nightAwarenessBonus !== undefined) {
    addCapabilityDetail(
      groups,

      "Contextual bonuses",

      `${formatBonus(contextual.nightAwarenessBonus)} awareness score at night.`,
    );
  }

  if (contextual.nightAmbushTargetWeightMultiplier !== undefined) {
    addCapabilityDetail(
      groups,

      "Contextual bonuses",

      "Reduces hostile targeting during " +
        "night ambushes by " +
        `${formatPercentageReduction(contextual.nightAmbushTargetWeightMultiplier)}%.`,
    );
  }
}

function createUtilityCapabilities(
  definition: ItemDefinition,
  groups: Map<string, string[]>,
): void {
  for (const { tag, detail } of UTILITY_TAG_DETAILS) {
    if (definition.tags.includes(tag)) {
      addCapabilityDetail(groups, "Utility", detail);
    }
  }
}

function createCapabilityGroups(definition: ItemDefinition): ItemCapabilityGroup[] {
  const groups = new Map<string, string[]>();

  createUseEffectCapabilities(definition, groups);

  createRestCapabilities(definition, groups);

  createOffenseCapabilities(definition, groups);

  createDefenseCapabilities(definition, groups);

  createPassiveBonusCapabilities(definition, groups);

  createContextualCapabilities(definition, groups);

  createUtilityCapabilities(definition, groups);

  return [...groups.entries()].map(([label, details]) => ({
    label,
    details,
  }));
}

export function createInventoryItemPresentation(
  owner: GameTribute,
  item: InventoryItem,
): InventoryItemPresentation {
  const definition = getItemDefinition(item.definitionId);

  const usability = getItemUsability(owner, item);

  return {
    label: definition.label,

    description: definition.description,

    usesLabel: createUsesLabel(definition, item),

    minimumRequirements: createMinimumRequirements(definition),

    usable: usability.usable,

    usabilityLabel: usability.usable
      ? `${owner.snapshot.name} can use this item.`
      : `${owner.snapshot.name} cannot use this item.`,

    unusableReasons: usability.reasons,

    capabilityGroups: createCapabilityGroups(definition),
  };
}
