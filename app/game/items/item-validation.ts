import type { ItemDefinition, ItemTag } from "~/game/items/item-schema";
import { ITEM_TAGS } from "~/game/items/item-schema";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId } from "~/game/statuses/status-schema";

const ITEM_TAG_SET = new Set<ItemTag>(ITEM_TAGS);

const ACTIVE_USE_TAGS = new Set<ItemTag>(["consumable", "water", "food", "medicine", "tool"]);

const PASSIVE_BONUS_KEYS = [
  "combatBonus",
  "survivalBonus",
  "awarenessBonus",
  "foragingBonus",
] as const;

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

  const satisfiedNeeds = new Set<string>();

  let removesMedicalStatuses = false;

  for (const effect of effects) {
    switch (effect.type) {
      case "satisfy-need": {
        if (satisfiedNeeds.has(effect.need)) {
          fail(definition.id, `satisfies "${effect.need}" more than once.`);
        }

        satisfiedNeeds.add(effect.need);

        const requiredTag = effect.need === "hydration" ? "water" : "food";

        if (!definition.tags.includes(requiredTag)) {
          fail(definition.id, `satisfies "${effect.need}" without the "${requiredTag}" tag.`);
        }

        if (!definition.tags.includes("consumable") || definition.maxUses === undefined) {
          fail(definition.id, `need-satisfaction effects require a limited-use consumable item.`);
        }

        break;
      }

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

  if (rest.check.stat !== "brains" && rest.check.stat !== "luck") {
    fail(definition.id, "declares an invalid rest-check stat.");
  }

  if (
    !Number.isInteger(rest.check.difficulty) ||
    rest.check.difficulty < 1 ||
    rest.check.difficulty > 5
  ) {
    fail(definition.id, "declares an invalid rest-check difficulty.");
  }
}

export function validateItemDefinition(definition: ItemDefinition): void {
  if (!definition.id.trim()) {
    fail(definition.id, "has an empty ID.");
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
    for (const [label, value] of [
      ["nightAwarenessBonus", contextual.nightAwarenessBonus],
      ["hostileDefenseBonus", contextual.hostileDefenseBonus],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        fail(definition.id, `declares invalid ${label}.`);
      }
    }

    const targetMultiplier = contextual.hostileTargetWeightMultiplier;

    if (
      targetMultiplier !== undefined &&
      (!Number.isFinite(targetMultiplier) || targetMultiplier < 0 || targetMultiplier > 1)
    ) {
      fail(definition.id, "declares invalid hostileTargetWeightMultiplier.");
    }
  }

  validateUseEffects(definition);
  validateRest(definition);
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
