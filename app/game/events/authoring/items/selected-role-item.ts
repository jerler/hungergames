import { createItemUseChange } from "~/game/events/event-change-builders";
import type { EventItemSelection, EventResolutionContext } from "~/game/events/event-schema";
import type { GameChange } from "~/game/types/game-state";

export function getSelectedRoleItem(
  context: EventResolutionContext,
  roleId: string,
  index = 0,
): EventItemSelection | null {
  return context.itemsByRole?.[roleId]?.[index] ?? null;
}

export function createSelectedRoleItemUseChanges(
  context: EventResolutionContext,
  roleId: string,
  reason = context.eventId,
  index = 0,
): GameChange[] {
  const selection = getSelectedRoleItem(context, roleId, index);

  return selection ? [createItemUseChange(selection.owner, selection.item, reason)] : [];
}
