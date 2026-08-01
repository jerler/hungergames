import type { EventDefinition } from "~/game/events/event-schema";
import { COMBAT_EVENTS } from "./combat-events";
import { CORNUCOPIA_PROVISION_EVENTS } from "./cornucopia-provision-events";
import { DAY_CRAFTING_EVENTS } from "./day-crafting-events";
import { DAY_EVENTS_16_33 } from "./day-events-continued";
import { DEPRIVATION_EVENTS } from "./deprivation-events";
import { STATUS_SPECIFIC_EVENTS } from "./status-specific-events";
import { DAY_EVENTS } from "./day-events";
import { RESOURCE_THEFT_EVENTS } from "./resource-theft-events";
import { ENVIRONMENTAL_EVENTS } from "./environmental-events";
import { FORAGING_EVENTS } from "./foraging-events";
import { GAMEMAKER_EVENTS } from "./gamemaker-events";
import { HUNTING_EVENTS } from "./hunting-events";
import { ITEM_USE_EVENTS } from "./item-use-events";
import { ACCIDENTAL_FATAL_NIGHT_EVENTS } from "./accidental-fatal-night-events";
import { FATAL_NIGHT_EVENTS } from "./fatal-night-events";
import { NIGHT_EVENTS } from "./night-events";
import { SURVIVAL_EVENTS } from "./survival-events";
import { TACTICAL_EVENTS } from "./tactical-events";
import { THEFT_EVENTS } from "./theft-events";

export {
  ACCIDENTAL_FATAL_NIGHT_EVENTS,
  DAY_CRAFTING_EVENTS,
  DAY_EVENTS,
  DAY_EVENTS_16_33,
  FATAL_NIGHT_EVENTS,
  NIGHT_EVENTS,
  STATUS_SPECIFIC_EVENTS,
  TACTICAL_EVENTS,
  THEFT_EVENTS,
};

export const ENCOUNTER_EVENTS = [
  ...CORNUCOPIA_PROVISION_EVENTS,
  ...DEPRIVATION_EVENTS,
  ...STATUS_SPECIFIC_EVENTS,
  ...RESOURCE_THEFT_EVENTS,
  ...COMBAT_EVENTS,
  ...TACTICAL_EVENTS,
  ...THEFT_EVENTS,
  ...ENVIRONMENTAL_EVENTS,
  ...DAY_EVENTS,
  ...DAY_EVENTS_16_33,
  ...DAY_CRAFTING_EVENTS,
  ...SURVIVAL_EVENTS,
  ...ACCIDENTAL_FATAL_NIGHT_EVENTS,
  ...FATAL_NIGHT_EVENTS,
  ...NIGHT_EVENTS,
  ...ITEM_USE_EVENTS,
  ...GAMEMAKER_EVENTS,
  ...HUNTING_EVENTS,
  ...FORAGING_EVENTS,
] satisfies readonly EventDefinition[];
