import type { GameConfig } from "~/game/types/game-config";

const GAME_CONFIG_DRAFT_KEY = "hungergames:game-config-draft";

export function saveGameConfigDraft(config: GameConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GAME_CONFIG_DRAFT_KEY, JSON.stringify(config));
}
