import type { EventDefinition } from "~/game/events/event-schema";

import { ENCOUNTER_EVENTS } from "./encounters";
import { RELATIONSHIP_EVENTS } from "./relationships";
import { STAT_GATED_EVENTS } from "./stat-gated";

export const EVENT_CATALOGUE = [
  ...ENCOUNTER_EVENTS,
  ...STAT_GATED_EVENTS,
  ...RELATIONSHIP_EVENTS,
] satisfies readonly EventDefinition[];
