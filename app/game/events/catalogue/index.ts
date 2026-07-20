import { CORE_EVENTS } from "~/game/events/event-catalogue";
import type { EventDefinition } from "~/game/events/event-schema";
import { POISONOUS_BERRIES_JOINT_VICTORY_EVENT } from "~/game/events/catalogue/poisonous-berries-event";
import { ROMANTIC_TRUCE_EVENTS } from "~/game/events/catalogue/romantic-truce-events";
import { SURVIVAL_MISADVENTURE_EVENTS } from "~/game/events/catalogue/survival-misadventure-events";
import { TOOL_AND_WEAPON_EVENTS } from "~/game/events/catalogue/tool-and-weapon-events";
import { TRUCE_CONFLICT_EVENTS } from "~/game/events/catalogue/truce-conflict-events";
import { TRUCE_DISSOLUTION_EVENTS } from "~/game/events/catalogue/truce-dissolution-events";
import { TRUCE_FORMATION_EVENTS } from "~/game/events/catalogue/truce-formation-events";
import { ARENA_HAZARD_EVENTS } from "./arena-hazard-events";
import { COMBAT_EVENTS } from "./combat-events";
import { SURVIVAL_EVENTS } from "./survival-events";

import { LUCK_EVENTS } from "./luck-events";

export const EVENT_CATALOGUE = [
  POISONOUS_BERRIES_JOINT_VICTORY_EVENT,
  ...CORE_EVENTS,
  ...COMBAT_EVENTS,
  ...ARENA_HAZARD_EVENTS,
  ...SURVIVAL_EVENTS,
  ...TRUCE_FORMATION_EVENTS,
  ...TRUCE_DISSOLUTION_EVENTS,
  ...TRUCE_CONFLICT_EVENTS,
  ...ROMANTIC_TRUCE_EVENTS,
  ...LUCK_EVENTS,
  ...SURVIVAL_MISADVENTURE_EVENTS,
  ...TOOL_AND_WEAPON_EVENTS,
] satisfies readonly EventDefinition[];
