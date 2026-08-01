import {
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_FATAL_BLOODBATH_EVENTS,
  CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_NONFATAL_INTERACTION_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
} from "./bloodbath";

import { COMBAT_EVENTS } from "./encounters/combat-events";

import { CORNUCOPIA_PROVISION_EVENTS } from "./encounters/cornucopia-provision-events";

import { DAY_CRAFTING_EVENTS } from "./encounters/day-crafting-events";

import { DAY_EVENTS_16_33 } from "./encounters/day-events-continued";

import { DAY_EVENTS } from "./encounters/day-events";
import { DEPRIVATION_EVENTS } from "./encounters/deprivation-events";
import { STATUS_SPECIFIC_EVENTS } from "./encounters/status-specific-events";

import { FOOD_THEFT_EVENTS, WATER_THEFT_EVENTS } from "./encounters/resource-theft-events";

import { ENVIRONMENTAL_EVENTS } from "./encounters/environmental-events";

import { FORAGING_EVENTS } from "./encounters/foraging-events";

import { GAMEMAKER_EVENTS } from "./encounters/gamemaker-events";

import { HUNTING_EVENTS } from "./encounters/hunting-events";

import { ITEM_USE_EVENTS } from "./encounters/item-use-events";

import { ACCIDENTAL_FATAL_NIGHT_EVENTS } from "./encounters/accidental-fatal-night-events";

import { FATAL_NIGHT_EVENTS } from "./encounters/fatal-night-events";

import { NIGHT_EVENTS } from "./encounters/night-events";

import { SURVIVAL_EVENTS } from "./encounters/survival-events";

import { TACTICAL_EVENTS } from "./encounters/tactical-events";

import { THEFT_EVENTS } from "./encounters/theft-events";

import { ROMANTIC_EVENTS } from "./relationships/romantic-events";

import { STANDARD_DISSOLUTION_EVENTS } from "./relationships/standard-dissolution-events";

import { STANDARD_FORMATION_EVENTS } from "./relationships/standard-formation-events";

import { STANDARD_INTERACTION_EVENTS } from "./relationships/standard-interaction-events";

import { HIGH_BRAINS_EVENTS } from "./stat-gated/brains/high-events";

import { LOW_BRAINS_EVENTS } from "./stat-gated/brains/low-events";

import { HIGH_BRAWN_EVENTS } from "./stat-gated/brawn/high-events";

import { LOW_BRAWN_EVENTS } from "./stat-gated/brawn/low-events";

import { HIGH_LUCK_EVENTS } from "./stat-gated/luck/high-events";

import { LOW_LUCK_EVENTS } from "./stat-gated/luck/low-events";

import { MIXED_STAT_GATED_EVENTS } from "./stat-gated/mixed-events";

import type { EventCatalogueFamily } from "../validation/validate-event-catalogues";

export const ORDINARY_EVENT_CATALOGUE_FAMILIES = [
  {
    name: "cornucopia-provisions",

    events: CORNUCOPIA_PROVISION_EVENTS,
  },

  {
    name: "deprivation",

    events: DEPRIVATION_EVENTS,
  },

  {
    name: "status-specific",

    events: STATUS_SPECIFIC_EVENTS,
  },
  {
    name: "day-authored-01-15",

    events: DAY_EVENTS,
  },

  {
    name: "day-authored-16-33",

    events: DAY_EVENTS_16_33,
  },

  {
    name: "day-weapon-crafting",

    events: DAY_CRAFTING_EVENTS,
  },

  {
    name: "food-theft",

    events: FOOD_THEFT_EVENTS,
  },

  {
    name: "water-theft",

    events: WATER_THEFT_EVENTS,
  },

  {
    name: "combat",

    events: COMBAT_EVENTS,
  },

  {
    name: "tactical",

    events: TACTICAL_EVENTS,
  },

  {
    name: "theft",

    events: THEFT_EVENTS,
  },

  {
    name: "environmental",

    events: ENVIRONMENTAL_EVENTS,
  },

  {
    name: "survival",

    events: SURVIVAL_EVENTS,
  },

  {
    name: "night-accidental-fatal",

    events: ACCIDENTAL_FATAL_NIGHT_EVENTS,
  },
  {
    name: "night-fatal",

    events: FATAL_NIGHT_EVENTS,
  },
  {
    name: "night",

    events: NIGHT_EVENTS,
  },

  {
    name: "hunting",

    events: HUNTING_EVENTS,
  },

  {
    name: "foraging",

    events: FORAGING_EVENTS,
  },

  {
    name: "item-use",

    events: ITEM_USE_EVENTS,
  },

  {
    name: "gamemaker",
    events: GAMEMAKER_EVENTS,
    allowEmpty: true,
  },

  {
    name: "high-brains",
    events: HIGH_BRAINS_EVENTS,
  },

  {
    name: "low-brains",
    events: LOW_BRAINS_EVENTS,
  },

  {
    name: "high-brawn",
    events: HIGH_BRAWN_EVENTS,
  },

  {
    name: "low-brawn",
    events: LOW_BRAWN_EVENTS,
  },

  {
    name: "high-luck",
    events: HIGH_LUCK_EVENTS,
  },

  {
    name: "low-luck",
    events: LOW_LUCK_EVENTS,
    allowEmpty: true,
  },

  {
    name: "mixed-stats",
    events: MIXED_STAT_GATED_EVENTS,
  },

  {
    name: "standard-formation",

    events: STANDARD_FORMATION_EVENTS,
  },

  {
    name: "standard-interaction",

    events: STANDARD_INTERACTION_EVENTS,
  },

  {
    name: "standard-dissolution",

    events: STANDARD_DISSOLUTION_EVENTS,
  },

  {
    name: "romantic",

    events: ROMANTIC_EVENTS,
  },
] satisfies readonly EventCatalogueFamily[];

export const BLOODBATH_EVENT_CATALOGUE_FAMILIES = [
  {
    name: "cornucopia-acquisition",

    events: CORNUCOPIA_ACQUISITION_EVENTS,
  },

  {
    name: "cornucopia-flavour-acquisition",

    events: CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  },

  {
    name: "cornucopia-fatal-authored",

    events: CORNUCOPIA_FATAL_BLOODBATH_EVENTS,
  },

  {
    name: "cornucopia-pair-conflict",

    events: CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  },

  {
    name: "cornucopia-group-conflict",

    events: CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  },

  {
    name: "cornucopia-nonfatal-interaction",

    events: CORNUCOPIA_NONFATAL_INTERACTION_EVENTS,
  },

  {
    name: "flee",

    events: FLEE_EVENTS,
  },
] satisfies readonly EventCatalogueFamily[];
