import type { EventDefinition } from "~/game/events/event-schema";

import { HIGH_BRAINS_EVENTS } from "./brains/high-events";
import { LOW_BRAINS_EVENTS } from "./brains/low-events";
import { HIGH_BRAWN_EVENTS } from "./brawn/high-events";
import { LOW_BRAWN_EVENTS } from "./brawn/low-events";
import { HIGH_LUCK_EVENTS } from "./luck/high-events";
import { LOW_LUCK_EVENTS } from "./luck/low-events";
import { MIXED_STAT_GATED_EVENTS } from "./mixed-events";

export const STAT_GATED_EVENTS = [
  ...HIGH_BRAINS_EVENTS,
  ...LOW_BRAINS_EVENTS,
  ...HIGH_BRAWN_EVENTS,
  ...LOW_BRAWN_EVENTS,
  ...HIGH_LUCK_EVENTS,
  ...LOW_LUCK_EVENTS,
  ...MIXED_STAT_GATED_EVENTS,
] satisfies readonly EventDefinition[];
