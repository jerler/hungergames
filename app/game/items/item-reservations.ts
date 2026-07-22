import type { GameChange } from "~/game/types/game-state";

/**
 * Returns every physical item instance committed by a collection
 * of resolved event changes, preserving the original change order.
 *
 * Duplicate IDs are intentionally preserved so callers can detect
 * an event or round that commits the same item more than once.
 */
export function getCommittedItemInstanceIds(changes: readonly GameChange[]): string[] {
  return changes.flatMap((change) => {
    switch (change.type) {
      case "acquire-item":
        return [change.item.id];

      case "use-item":
      case "consume-item":
      case "transfer-item":
        return [change.itemInstanceId];

      default:
        return [];
    }
  });
}
