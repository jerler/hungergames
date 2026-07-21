/**
 * Mixed stat-gated events
 * Ex: 
 * isEligible: (tribute) =>
    isStatAtLeast(
      tribute.snapshot.stats,
      "brains",
      4,
    ) ||
    isStatAtLeast(
      tribute.snapshot.stats,
      "luck",
      4,
    )
 */

import type { EventDefinition } from "~/game/events/event-schema";

export const MIXED_STAT_GATED_EVENTS = [
  /* Day Only */
  /* Night Only */
  /* Day and Night */
] satisfies readonly EventDefinition[];
