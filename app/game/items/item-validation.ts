import type { ItemDefinition, ItemTag } from "~/game/items/item-schema";
import { ITEM_TAGS } from "~/game/items/item-schema";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId } from "~/game/statuses/status-schema";

const ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ITEM_TAG_SET = new Set<ItemTag>(ITEM_TAGS);

const ACTIVE_USE_TAGS = new Set<ItemTag>(["consumable", "medicine", "tool"]);

const PASSIVE_BONUS_KEYS = ["survivalBonus", "awarenessBonus", "foragingBonus"] as const;

function fail(itemId: string, message: string): never {
  throw new Error(`Invalid item "${itemId}": ${message}`);
}

function validateStatusReference(itemId: string, statusId: StatusEffectId): void {
  try {
    getStatusDefinition(statusId);
  } catch {
    fail(itemId, `references unknown status "${statusId}".`);
  }
}

function validateUseEffects(definition: ItemDefinition): void {
  const effects = definition.useEffects;

  if (!effects) {
    return;
  }

  if (effects.length === 0) {
    fail(definition.id, "declares an empty use-effects list.");
  }

  const hasSupportedUseMechanism =
    definition.maxUses !== undefined || definition.tags.some((tag) => ACTIVE_USE_TAGS.has(tag));

  if (!hasSupportedUseMechanism) {
    fail(definition.id, "declares active effects without a supported use mechanism.");
  }

  const removedStatuses = new Set<StatusEffectId>();

  const grantedStatuses = new Set<StatusEffectId>();

  let removesMedicalStatuses = false;

  for (const effect of effects) {
    switch (effect.type) {
      case "remove-status": {
        if (effect.statusIds.length === 0) {
          fail(definition.id, "declares remove-status without any statuses.");
        }

        for (const statusId of effect.statusIds) {
          validateStatusReference(definition.id, statusId);

          if (removedStatuses.has(statusId)) {
            fail(definition.id, `removes status "${statusId}" more than once.`);
          }

          removedStatuses.add(statusId);
        }

        break;
      }

      case "remove-medical-statuses":
        if (!definition.tags.includes("medicine")) {
          fail(definition.id, "removes medical statuses without the medicine tag.");
        }

        removesMedicalStatuses = true;
        break;

      case "grant-status": {
        validateStatusReference(definition.id, effect.statusId);

        if (grantedStatuses.has(effect.statusId)) {
          fail(definition.id, `grants status "${effect.statusId}" more than once.`);
        }

        grantedStatuses.add(effect.statusId);

        if (!Number.isInteger(effect.severity) || effect.severity < 1 || effect.severity > 3) {
          fail(definition.id, `grants status "${effect.statusId}" with invalid severity.`);
        }

        if (effect.durationRounds !== undefined) {
          if (!Number.isInteger(effect.durationRounds) || effect.durationRounds <= 0) {
            fail(definition.id, "declares an invalid status duration override.");
          }

          const statusDefinition = getStatusDefinition(effect.statusId);

          if (statusDefinition.duration.kind === "persistent") {
            fail(definition.id, `cannot override persistent status "${effect.statusId}".`);
          }
        }

        break;
      }

      case "chance-to-grant-status": {
        validateStatusReference(definition.id, effect.statusId);

        if (grantedStatuses.has(effect.statusId)) {
          fail(definition.id, `grants status "${effect.statusId}" more than once.`);
        }

        grantedStatuses.add(effect.statusId);

        if (!Number.isInteger(effect.severity) || effect.severity < 1 || effect.severity > 3) {
          fail(definition.id, `grants status "${effect.statusId}" with invalid severity.`);
        }

        if (!Number.isFinite(effect.chance) || effect.chance <= 0 || effect.chance > 1) {
          fail(definition.id, `declares invalid chance for status "${effect.statusId}".`);
        }

        if (effect.durationRounds !== undefined) {
          if (!Number.isInteger(effect.durationRounds) || effect.durationRounds <= 0) {
            fail(definition.id, "declares an invalid status duration override.");
          }

          const statusDefinition = getStatusDefinition(effect.statusId);

          if (statusDefinition.duration.kind === "persistent") {
            fail(definition.id, `cannot override persistent status "${effect.statusId}".`);
          }
        }

        break;
      }
    }
  }

  for (const statusId of grantedStatuses) {
    if (removedStatuses.has(statusId) || (removesMedicalStatuses && isMedicalStatusId(statusId))) {
      fail(definition.id, `both removes and grants status "${statusId}".`);
    }
  }
}

function validateRest(definition: ItemDefinition): void {
  const rest = definition.rest;

  if (!rest) {
    return;
  }

  const hasRestTag = definition.tags.includes("shelter") || definition.tags.includes("comfort");

  if (!hasRestTag) {
    fail(definition.id, "declares rest without a shelter or comfort tag.");
  }

  if (rest.quality !== "comfortable" && rest.quality !== "sheltered") {
    fail(definition.id, "declares an invalid rest quality.");
  }

  if (!rest.check) {
    return;
  }

  if (
    rest.check.stat !== "brains" &&
    rest.check.stat !== "luck" &&
    rest.check.stat !== "brains-or-luck"
  ) {
    fail(definition.id, "declares an invalid rest-check stat.");
  }

  if (
    !Number.isInteger(rest.check.difficulty) ||
    rest.check.difficulty < 1 ||
    rest.check.difficulty > 5
  ) {
    fail(definition.id, "declares an invalid rest-check difficulty.");
  }

  const criticalFailureStatus = rest.check.criticalFailureStatus;

  if (!criticalFailureStatus) {
    return;
  }

  validateStatusReference(definition.id, criticalFailureStatus.statusId);

  if (
    !Number.isInteger(criticalFailureStatus.severity) ||
    criticalFailureStatus.severity < 1 ||
    criticalFailureStatus.severity > 3
  ) {
    fail(definition.id, "declares an invalid critical-failure status severity.");
  }

  if (criticalFailureStatus.durationRounds !== undefined) {
    if (
      !Number.isInteger(criticalFailureStatus.durationRounds) ||
      criticalFailureStatus.durationRounds <= 0
    ) {
      fail(definition.id, "declares an invalid critical-failure status duration.");
    }

    const statusDefinition = getStatusDefinition(criticalFailureStatus.statusId);

    if (statusDefinition.duration.kind === "persistent") {
      fail(definition.id, `cannot override persistent status "${criticalFailureStatus.statusId}".`);
    }
  }
}

function validateOffense(definition: ItemDefinition): void {
  const offense = definition.offense;

  if (!offense) {
    return;
  }

  if (!definition.tags.includes("weapon")) {
    fail(definition.id, "declares offense without the weapon tag.");
  }

  switch (offense.strategy) {
    case "direct":
      if (!Number.isFinite(offense.attackBonus) || offense.attackBonus <= 0) {
        fail(definition.id, "declares an invalid direct attack bonus.");
      }

      if (!definition.tags.includes("direct-weapon")) {
        fail(definition.id, "declares direct offense without the direct-weapon tag.");
      }

      break;

    case "poison":
    case "trap":
    case "risky-area":
      if (!definition.tags.includes("tactical")) {
        fail(definition.id, `declares ${offense.strategy} offense without the tactical tag.`);
      }

      break;
  }
}

function validateDefense(definition: ItemDefinition): void {
  const defense = definition.defense;

  if (!defense) {
    return;
  }

  if (!definition.tags.includes("defense")) {
    fail(definition.id, "declares defense capabilities without the defense tag.");
  }

  if (!Number.isFinite(defense.checkedAttackBonus) || defense.checkedAttackBonus < 0) {
    fail(definition.id, "declares an invalid checked attack defense bonus.");
  }

  if (
    !Number.isFinite(defense.hostileTargetWeightMultiplier) ||
    defense.hostileTargetWeightMultiplier <= 0 ||
    defense.hostileTargetWeightMultiplier > 1
  ) {
    fail(definition.id, "declares an invalid hostile target weight multiplier.");
  }
}

export function validateItemDefinition(definition: ItemDefinition): void {
  if (!ITEM_ID_PATTERN.test(definition.id)) {
    fail(definition.id, "ID must be non-empty kebab-case text.");
  }

  if (!definition.label.trim()) {
    fail(definition.id, "has an empty label.");
  }

  if (!definition.description.trim()) {
    fail(definition.id, "has an empty description.");
  }

  if (new Set(definition.tags).size !== definition.tags.length) {
    fail(definition.id, "declares duplicate tags.");
  }

  for (const tag of definition.tags) {
    if (!ITEM_TAG_SET.has(tag)) {
      fail(definition.id, `references unknown tag "${String(tag)}".`);
    }
  }

  if (
    definition.maxUses !== undefined &&
    (!Number.isInteger(definition.maxUses) || definition.maxUses <= 0)
  ) {
    fail(definition.id, "declares invalid maximum uses.");
  }

  if (definition.tags.includes("consumable") && definition.maxUses === undefined) {
    fail(definition.id, "is tagged consumable without limited uses.");
  }

  for (const [stat, minimum] of Object.entries(definition.minimumStats ?? {})) {
    if (
      !["brains", "brawn", "luck"].includes(stat) ||
      !Number.isInteger(minimum) ||
      minimum < 1 ||
      minimum > 5
    ) {
      fail(definition.id, `declares invalid minimum ${stat}.`);
    }
  }

  for (const bonusKey of PASSIVE_BONUS_KEYS) {
    const bonus = definition[bonusKey];

    if (bonus !== undefined && (!Number.isFinite(bonus) || bonus < 0)) {
      fail(definition.id, `declares invalid ${bonusKey}.`);
    }
  }

  const contextual = definition.contextual;

  if (contextual) {
    const nightAwarenessBonus = contextual.nightAwarenessBonus;

    if (
      nightAwarenessBonus !== undefined &&
      (!Number.isFinite(nightAwarenessBonus) || nightAwarenessBonus < 0)
    ) {
      fail(definition.id, "declares invalid nightAwarenessBonus.");
    }

    const nightAmbushMultiplier = contextual.nightAmbushTargetWeightMultiplier;

    if (
      nightAmbushMultiplier !== undefined &&
      (!Number.isFinite(nightAmbushMultiplier) ||
        nightAmbushMultiplier < 0 ||
        nightAmbushMultiplier > 1)
    ) {
      fail(definition.id, "declares invalid nightAmbushTargetWeightMultiplier.");
    }
  }

  validateOffense(definition);

  validateDefense(definition);

  validateUseEffects(definition);
  validateRest(definition);

  if (definition.origin !== "natural-resource" && definition.origin !== "manufactured") {
    fail(definition.id, "declares an invalid origin.");
  }

  if (definition.tags.length === 0) {
    fail(definition.id, "must declare at least one tag.");
  }
}

export function validateItemCatalogue(definitions: readonly ItemDefinition[]): void {
  const itemIds = definitions.map((definition) => definition.id);

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Item catalogue contains duplicate IDs.");
  }

  for (const definition of definitions) {
    validateItemDefinition(definition);
  }
}
