import { shuffleItems, type RandomSource } from "~/game/engine/random";
import type {
  GameState,
  InventoryItem,
  TransferInventoryItemChange,
  Truce,
} from "~/game/types/game-state";

interface OwnedInventoryItem {
  ownerId: string;
  item: InventoryItem;
}

export function createEvenTruceInventoryRedistributionChanges(
  state: GameState,
  truce: Truce,
  random: RandomSource,
  reason: string,
): TransferInventoryItemChange[] {
  const members = truce.tributeIds.map((tributeId) => {
    const tribute = state.tributes.find((candidate) => candidate.id === tributeId);

    if (!tribute) {
      throw new Error(`Truce "${truce.id}" references ` + `missing tribute "${tributeId}".`);
    }

    if (!tribute.isAlive) {
      throw new Error(
        `Cannot amicably redistribute inventory ` + `with dead tribute "${tributeId}".`,
      );
    }

    return tribute;
  });

  if (members.length < 2) {
    throw new Error(`Truce "${truce.id}" does not have ` + "enough members for redistribution.");
  }

  const pooledItems: OwnedInventoryItem[] = members.flatMap((tribute) =>
    tribute.inventory.map((item) => ({
      ownerId: tribute.id,

      item,
    })),
  );

  if (pooledItems.length === 0) {
    return [];
  }

  /*
   * Shuffle both the gear and the
   * recipient order. Round-robin
   * assignment then guarantees that
   * final inventory counts differ by
   * no more than one.
   */
  const shuffledItems = shuffleItems(pooledItems, random);

  const recipientIds = shuffleItems(
    members.map((member) => member.id),
    random,
  );

  return shuffledItems.flatMap(({ ownerId, item }, index) => {
    const recipientId = recipientIds[index % recipientIds.length];

    if (recipientId === ownerId) {
      return [];
    }

    return [
      {
        type: "transfer-item",
        itemInstanceId: item.id,

        fromTributeId: ownerId,

        toTributeId: recipientId,

        reason,
      },
    ];
  });
}
