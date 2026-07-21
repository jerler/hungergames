import type { EventDefinition } from "~/game/events/event-schema";

import { COMBAT_EVENTS } from "./combat-events";
import { ENVIRONMENTAL_EVENTS } from "./environmental-events";
import { GAMEMAKER_EVENTS } from "./gamemaker-events";
import { ITEM_USE_EVENTS } from "./item-use-events";
import { SURVIVAL_EVENTS } from "./survival-events";

export const ENCOUNTER_EVENTS = [
  ...COMBAT_EVENTS,
  ...ENVIRONMENTAL_EVENTS,
  ...SURVIVAL_EVENTS,
  ...ITEM_USE_EVENTS,
  ...GAMEMAKER_EVENTS,
] satisfies readonly EventDefinition[];
