import type { EventDefinition } from "~/game/events/event-schema";

/*
 * Gamemaker events may manipulate the arena, create hazards,
 * or alter existing conditions.
 *
 * The former Capitol prize-crate event was removed because it
 * generated manufactured equipment during ordinary rounds.
 * Cornucopia crates will instead belong to the dedicated
 * Day 1 Bloodbath catalogue.
 */
export const GAMEMAKER_EVENTS = [] satisfies readonly EventDefinition[];
