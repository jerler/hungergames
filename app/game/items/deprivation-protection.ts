import { getItemDefinition } from "./item-catalogue";
import type { GameTribute } from "~/game/types/game-state";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

export const CORNUCOPIA_PROVISIONS_ITEM_ID = "cornucopia-provisions" as const;

export function hasDeprivationProtection(tribute: GameTribute, need: SurvivalNeed): boolean {
  return tribute.inventory.some((item) =>
    getItemDefinition(item.definitionId).deprivationProtection?.includes(need),
  );
}

export function hasCornucopiaProvisions(tribute: GameTribute): boolean {
  return tribute.inventory.some((item) => item.definitionId === CORNUCOPIA_PROVISIONS_ITEM_ID);
}
