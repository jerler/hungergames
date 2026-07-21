import type { EventDefinition } from "~/game/events/event-schema";

import { ROMANTIC_EVENTS } from "./romantic-events";
import { STANDARD_DISSOLUTION_EVENTS } from "./standard-dissolution-events";
import { STANDARD_FORMATION_EVENTS } from "./standard-formation-events";
import { STANDARD_INTERACTION_EVENTS } from "./standard-interaction-events";

export const RELATIONSHIP_EVENTS = [
  ...STANDARD_FORMATION_EVENTS,
  ...STANDARD_INTERACTION_EVENTS,
  ...STANDARD_DISSOLUTION_EVENTS,
  ...ROMANTIC_EVENTS,
] satisfies readonly EventDefinition[];
