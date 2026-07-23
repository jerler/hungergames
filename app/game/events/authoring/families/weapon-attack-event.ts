import { createEvent } from "~/game/events/authoring/builder/create-event";
import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import type { WeaponAttackCheck } from "~/game/events/authoring/checks/combat-check";
import { kill } from "~/game/events/authoring/effects/fatal-effects";
import type { EventEffect } from "~/game/events/authoring/effects/effect-schema";
import {
  createSelectedRoleItemUseChanges,
  getSelectedRoleItem,
} from "~/game/events/authoring/items/selected-role-item";
import type { EventResult } from "~/game/events/authoring/outcomes/outcome-schema";
import { result } from "~/game/events/authoring/outcomes/result";
import { hasItem, hasItemTag } from "~/game/events/authoring/requirements/item-requirements";
import type {
  AuthoredRequirement,
  RequiredItemAccess,
} from "~/game/events/authoring/requirements/requirement-schema";
import { combatRolePair } from "~/game/events/authoring/roles/combat-role-pair";
import type { AuthoredRoleOptions } from "~/game/events/authoring/roles/role-schema";
import { customResolution } from "~/game/events/authoring/strategies/custom-resolution";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventTag,
} from "~/game/events/event-schema";
import type { ItemDefinitionId, ItemTag } from "~/game/items/item-schema";
import type { RoundReference } from "~/game/types/game-state";

import { mergeEventTags } from "./family-types";

export type WeaponUseTiming = "always" | "success" | "never";

export interface WeaponAttackEventOptions {
  /**
   * Declare exactly one weapon requirement.
   */
  weaponId?: ItemDefinitionId;
  weaponTag?: ItemTag;

  access?: RequiredItemAccess;

  causeId?: string;
  causeLabel: string;

  /**
   * Fatal success text.
   */
  text: EventText;

  /**
   * Omit to preserve guaranteed-kill behaviour.
   *
   * Supplying a check requires a nonfatal failure result and
   * categorizes the definition as a hazard rather than fatal.
   */
  check?: WeaponAttackCheck;
  failure?: EventResult;

  successEffects?: readonly EventEffect[];

  weaponUse?: WeaponUseTiming;
  itemReason?: string;

  killerRoleId?: string;
  victimRoleId?: string;

  killerRoleOptions?: AuthoredRoleOptions;
  victimRoleOptions?: AuthoredRoleOptions;

  tags?: readonly EventTag[];
  periods?: readonly RoundReference["period"][];
  weight?: number;

  requirements?: readonly AuthoredRequirement[];
}

export function createWeaponAttackEvent(
  id: string,
  {
    weaponId,
    weaponTag,
    access = "accessible",

    causeId = id,
    causeLabel,
    text,

    check,
    failure,
    successEffects = [],

    weaponUse = "always",
    itemReason = id,

    killerRoleId = "killer",
    victimRoleId = "victim",

    killerRoleOptions = {},
    victimRoleOptions = {},

    tags = [],
    periods = ["day", "night"],
    weight = 1,
    requirements = [],
  }: WeaponAttackEventOptions,
): EventDefinition {
  if (Boolean(weaponId) === Boolean(weaponTag)) {
    throw new Error(
      `Weapon attack event "${id}" must declare exactly one weapon ID or weapon tag.`,
    );
  }

  if (check && !failure) {
    throw new Error(
      `Weapon attack event "${id}" requires a failure result when an attack check is configured.`,
    );
  }

  if (!check && failure) {
    throw new Error(
      `Weapon attack event "${id}" cannot declare an unreachable failure result without an attack check.`,
    );
  }

  const category = check ? "hazard" : "fatal";

  const weaponRequirement = weaponId
    ? hasItem(killerRoleId, {
        definitionIds: [weaponId],
        access,
      })
    : hasItemTag(killerRoleId, {
        tags: [weaponTag as ItemTag],
        access,
      });

  const success = result({
    text,

    effects: [
      kill(killerRoleId, victimRoleId, {
        causeId,
        causeLabel,
      }),

      ...successEffects,
    ],
  });

  return createEvent(id)
    .roles(
      ...combatRolePair({
        killerRoleId,
        victimRoleId,

        killer: killerRoleOptions,
        victim: victimRoleOptions,
      }),
    )
    .when(weaponRequirement, ...requirements)
    .category(category)
    .tags(...mergeEventTags([category, "combat", "weapon", "fatal"], tags))
    .during(...periods)
    .weight(weight)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const killer = requireSingleParticipant(context.participantsByRole, killerRoleId);

          const victim = requireSingleParticipant(context.participantsByRole, victimRoleId);

          const weapon = getSelectedRoleItem(context, killerRoleId);

          if (!weapon) {
            throw new Error(
              `Weapon attack event "${context.eventId}" resolved without its selected weapon.`,
            );
          }

          const outcome = check
            ? check({
                state: context.state,
                round: context.round,
                random: context.random,

                killer,
                victim,
                weapon,
              })
            : "success";

          if (outcome === "failure" && !failure) {
            throw new Error(
              `Weapon attack event "${context.eventId}" resolved failure without an authored failure result.`,
            );
          }

          const resolution = resolveResult(
            outcome === "success" ? success : (failure as EventResult),
          );

          const recordWeaponUse =
            weaponUse === "always" || (weaponUse === "success" && outcome === "success");

          return {
            ...resolution,

            changes: [
              ...resolution.changes,

              ...(recordWeaponUse
                ? createSelectedRoleItemUseChanges(context, killerRoleId, itemReason)
                : []),
            ],
          };
        },

        {
          possibleResults: failure ? [success, failure] : [success],
        },
      ),
    );
}
