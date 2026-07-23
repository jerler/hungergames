import { createWeaponAttackEvent } from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const COMBAT_EVENTS = [
  /* Day Only */

  createWeaponAttackEvent("spear-attack", {
    weaponId: "spear",
    causeLabel: "Speared",
    periods: ["day"],
    weight: 2.25,
    text: ({ killer, victim }) => `${killer.name} strikes ${victim.name} down with a spear.`,
  }),

  /* Night Only */

  /* Day and Night */

  createWeaponAttackEvent("knife-ambush", {
    weaponId: "knife",
    causeLabel: "Knifed",
    periods: ["day", "night"],
    weight: 2.5,
    text: ({ killer, victim }) =>
      `${killer.name} catches ${victim.name} by surprise and kills ${victim.pronouns.object} with a knife.`,
  }),
] satisfies readonly EventDefinition[];
