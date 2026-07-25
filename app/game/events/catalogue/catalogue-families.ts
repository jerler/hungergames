import {
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
} from "./bloodbath";

import { COMBAT_EVENTS } from "./encounters/combat-events";

import { ENVIRONMENTAL_EVENTS } from "./encounters/environmental-events";

import { FORAGING_EVENTS } from "./encounters/foraging-events";

import { GAMEMAKER_EVENTS } from "./encounters/gamemaker-events";

import { HUNTING_EVENTS } from "./encounters/hunting-events";

import { ITEM_USE_EVENTS } from "./encounters/item-use-events";

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
    allowEmpty: true,
  },

  {
    name: "low-brains",
    events: LOW_BRAINS_EVENTS,
    allowEmpty: true,
  },

  {
    name: "high-brawn",
    events: HIGH_BRAWN_EVENTS,
    allowEmpty: true,
  },

  {
    name: "low-brawn",
    events: LOW_BRAWN_EVENTS,
    allowEmpty: true,
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
    allowEmpty: true,
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
    name: "cornucopia-pair-conflict",

    events: CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  },

  {
    name: "cornucopia-group-conflict",

    events: CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  },

  {
    name: "flee",

    events: FLEE_EVENTS,
  },
] satisfies readonly EventCatalogueFamily[];
