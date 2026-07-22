import type { EventDefinition } from "~/game/events/event-schema";

/*
 * Low-Luck events will be reintroduced as the catalogue expands.
 *
 * The former runaway-vending-machine event was removed because
 * manufactured items cannot appear spontaneously in the arena.
 */
export const LOW_LUCK_EVENTS = [] satisfies readonly EventDefinition[];
