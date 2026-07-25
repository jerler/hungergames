import {
  createWeaponAttackEvent,
  ordinaryAttackCheck,
  result,
  survived,
} from "~/game/events/authoring";

import type { EventText } from "~/game/events/authoring";

import type { EventDefinition, EventTag } from "~/game/events/event-schema";

import type { ItemDefinitionId } from "~/game/items/item-schema";

import type { RoundReference } from "~/game/types/game-state";

interface DirectCombatEventConfig {
  id: string;

  weaponId: ItemDefinitionId;

  causeLabel: string;

  periods: readonly RoundReference["period"][];

  weight: number;

  tags?: readonly EventTag[];

  successText: EventText;
  failureText: EventText;
}

const DIRECT_COMBAT_CONFIGS = [
  {
    id: "knife-ambush",

    weaponId: "knife",

    causeLabel: "Knifed",

    periods: ["day", "night"],

    weight: 2.5,

    tags: ["ambush"],

    successText: ({ killer, victim }) =>
      `${killer.name} catches ${victim.name} by surprise and kills ${victim.pronouns.object} with a knife.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} lunges at ${victim.name} with a knife, but ${victim.name} twists away and escapes.`,
  },

  {
    id: "short-sword-duel",

    weaponId: "short-sword",

    causeLabel: "Killed in a short-sword duel",

    periods: ["day", "night"],

    weight: 1.8,

    successText: ({ killer, victim }) =>
      `${killer.name} overwhelms ${victim.name} in a short-sword duel.`,

    failureText: ({ killer, victim }) =>
      `${victim.name} parries ${killer.name}'s short sword and forces ${killer.name} to retreat.`,
  },

  {
    id: "rapier-lunge",

    weaponId: "rapier",

    causeLabel: "Run through with a rapier",

    periods: ["day", "night"],

    weight: 1.7,

    successText: ({ killer, victim }) =>
      `${killer.name} slips past ${victim.name}'s guard and strikes a fatal blow with a rapier.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} lunges with a rapier, but ${victim.name} knocks the point aside and escapes.`,
  },

  {
    id: "longsword-attack",

    weaponId: "longsword",

    causeLabel: "Slain with a longsword",

    periods: ["day", "night"],

    weight: 1.6,

    successText: ({ killer, victim }) =>
      `${killer.name} cuts ${victim.name} down with a longsword.`,

    failureText: ({ killer, victim }) =>
      `${victim.name} ducks beneath ${killer.name}'s longsword and scrambles out of reach.`,
  },

  {
    id: "greatsword-charge",

    weaponId: "greatsword",

    causeLabel: "Cut down with a greatsword",

    periods: ["day"],

    weight: 1.2,

    successText: ({ killer, victim }) =>
      `${killer.name} charges through ${victim.name}'s defence and cuts ${victim.pronouns.object} down with a greatsword.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} swings a greatsword at ${victim.name}, but the enormous blade gives ${victim.name} time to flee.`,
  },

  {
    id: "spear-attack",

    weaponId: "spear",

    causeLabel: "Speared",

    periods: ["day"],

    weight: 2.25,

    successText: ({ killer, victim }) => `${killer.name} strikes ${victim.name} down with a spear.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} thrusts a spear at ${victim.name}, but ${victim.name} knocks it aside and escapes.`,
  },

  {
    id: "pike-charge",

    weaponId: "pike",

    causeLabel: "Impaled with a pike",

    periods: ["day"],

    weight: 1.5,

    successText: ({ killer, victim }) =>
      `${killer.name} keeps ${victim.name} at the end of a pike before delivering a fatal thrust.`,

    failureText: ({ killer, victim }) =>
      `${victim.name} slips past the end of ${killer.name}'s pike and escapes before it can be repositioned.`,
  },

  {
    id: "trident-attack",

    weaponId: "trident",

    causeLabel: "Killed with a trident",

    periods: ["day", "night"],

    weight: 1.5,

    successText: ({ killer, victim }) =>
      `${killer.name} traps ${victim.name} with a trident and delivers a fatal strike.`,

    failureText: ({ killer, victim }) =>
      `${victim.name} tears free of ${killer.name}'s trident and escapes.`,
  },

  {
    id: "bow-shot",

    weaponId: "bow",

    causeLabel: "Shot with a bow",

    periods: ["day", "night"],

    weight: 2,

    successText: ({ killer, victim }) =>
      `${killer.name} takes careful aim and kills ${victim.name} with an arrow.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} fires at ${victim.name}, but the arrow misses and ${victim.name} disappears into cover.`,
  },

  {
    id: "longbow-shot",

    weaponId: "longbow",

    causeLabel: "Shot with a longbow",

    periods: ["day"],

    weight: 1.5,

    successText: ({ killer, victim }) =>
      `${killer.name} draws a longbow and strikes ${victim.name} from across the arena.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} looses a longbow arrow at ${victim.name}, but ${victim.name} dives behind cover.`,
  },

  {
    id: "crossbow-attack",

    weaponId: "crossbow",

    causeLabel: "Shot with a crossbow",

    periods: ["day", "night"],

    weight: 1.7,

    successText: ({ killer, victim }) =>
      `${killer.name} lines up a crossbow shot and kills ${victim.name} with a bolt.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} fires a crossbow at ${victim.name}, but the bolt strikes the terrain beside ${victim.pronouns.object}.`,
  },

  {
    id: "hand-axe-attack",

    weaponId: "hand-axe",

    causeLabel: "Killed with a hand axe",

    periods: ["day", "night"],

    weight: 1.8,

    successText: ({ killer, victim }) =>
      `${killer.name} closes the distance and kills ${victim.name} with a hand axe.`,

    failureText: ({ killer, victim }) =>
      `${victim.name} avoids ${killer.name}'s hand axe and escapes before another strike.`,
  },

  {
    id: "axe-attack",

    weaponId: "axe",

    causeLabel: "Killed with an axe",

    periods: ["day"],

    weight: 1.7,

    successText: ({ killer, victim }) =>
      `${killer.name} catches ${victim.name} in the open and kills ${victim.pronouns.object} with an axe.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} swings an axe at ${victim.name}, but the strike catches on a fallen branch and ${victim.name} escapes.`,
  },

  {
    id: "club-attack",

    weaponId: "club",

    causeLabel: "Bludgeoned",

    periods: ["day", "night"],

    weight: 1.6,

    successText: ({ killer, victim }) =>
      `${killer.name} overpowers ${victim.name} and kills ${victim.pronouns.object} with a club.`,

    failureText: ({ killer, victim }) =>
      `${victim.name} blocks ${killer.name}'s club long enough to break away and flee.`,
  },

  {
    id: "warhammer-attack",

    weaponId: "warhammer",

    causeLabel: "Crushed with a warhammer",

    periods: ["day"],

    weight: 1.1,

    successText: ({ killer, victim }) =>
      `${killer.name} brings a warhammer down with terrifying force and kills ${victim.name}.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} commits to a massive warhammer swing, but ${victim.name} moves before the blow lands.`,
  },
] as const satisfies readonly DirectCombatEventConfig[];

export const COMBAT_EVENTS = DIRECT_COMBAT_CONFIGS.map((config: DirectCombatEventConfig) =>
  createWeaponAttackEvent(config.id, {
    weaponId: config.weaponId,

    causeLabel: config.causeLabel,

    text: config.successText,

    check: ordinaryAttackCheck(),

    failure: result({
      text: config.failureText,

      effects: [survived("killer"), survived("victim")],
    }),

    safetyResolution: "force-success",

    periods: config.periods,

    weight: config.weight,

    tags: config.tags ?? [],
  }),
) satisfies readonly EventDefinition[];
