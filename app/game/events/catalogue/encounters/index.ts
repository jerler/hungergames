import type { EventDefinition } from "~/game/events/event-schema";
import { COMBAT_EVENTS } from "./combat-events";
import { CORNUCOPIA_PROVISION_EVENTS } from "./cornucopia-provision-events";
import { DEPRIVATION_EVENTS } from "./deprivation-events";
import { RESOURCE_THEFT_EVENTS } from "./resource-theft-events";
import { ENVIRONMENTAL_EVENTS } from "./environmental-events";
import { FORAGING_EVENTS } from "./foraging-events";
import { GAMEMAKER_EVENTS } from "./gamemaker-events";
import { HUNTING_EVENTS } from "./hunting-events";
import { ITEM_USE_EVENTS } from "./item-use-events";
import { SURVIVAL_EVENTS } from "./survival-events";
import { TACTICAL_EVENTS } from "./tactical-events";
import { THEFT_EVENTS } from "./theft-events";

export { TACTICAL_EVENTS, THEFT_EVENTS };

export const ENCOUNTER_EVENTS = [
  ...CORNUCOPIA_PROVISION_EVENTS,
  ...DEPRIVATION_EVENTS,
  ...RESOURCE_THEFT_EVENTS,
  ...COMBAT_EVENTS,
  ...TACTICAL_EVENTS,
  ...THEFT_EVENTS,
  ...ENVIRONMENTAL_EVENTS,
  ...SURVIVAL_EVENTS,
  ...ITEM_USE_EVENTS,
  ...GAMEMAKER_EVENTS,
  ...HUNTING_EVENTS,
  ...FORAGING_EVENTS,
] satisfies readonly EventDefinition[];
