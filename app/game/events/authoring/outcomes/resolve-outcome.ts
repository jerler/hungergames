import {
  resolveEventText,
  type EventText,
  type EventTextContext,
} from "~/game/events/authoring/characters/event-text-context";

import type { EventResult } from "./outcome-schema";

export function resolveOutcomeText(
  eventId: string,
  result: EventResult,
  context: EventTextContext,
  intro?: EventText,
): string {
  if (result.text !== undefined) {
    return resolveEventText(result.text, context);
  }

  const introText = intro === undefined ? "" : resolveEventText(intro, context);

  const appendText = result.append === undefined ? "" : resolveEventText(result.append, context);

  const text = `${introText}${appendText}`;

  if (text.trim().length === 0) {
    throw new Error(`Event "${eventId}" resolved without player-facing text.`);
  }

  return text;
}
