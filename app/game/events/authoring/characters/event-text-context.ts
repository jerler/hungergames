import { requireSingleParticipant, type EventResolutionContext } from "~/game/events/event-schema";

import { createEventCharacter, type EventCharacter } from "./event-character";

export type EventTextContext = Readonly<Record<string, EventCharacter>>;

export type EventText = string | ((context: EventTextContext) => string);

export function createEventTextContext(
  context: EventResolutionContext,
  roleIds: readonly string[],
): EventTextContext {
  return Object.fromEntries(
    roleIds.map((roleId) => [
      roleId,
      createEventCharacter(requireSingleParticipant(context.participantsByRole, roleId)),
    ]),
  );
}

export function resolveEventText(text: EventText, context: EventTextContext): string {
  return typeof text === "function" ? text(context) : text;
}
