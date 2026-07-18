import type { GameConfig } from "~/game/types/game-config";

const GAME_CONFIG_DRAFT_KEY = "hungergames:game-config-draft";

export function saveGameConfigDraft(config: GameConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GAME_CONFIG_DRAFT_KEY, JSON.stringify(config));
}

export function loadGameConfigDraft(): GameConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedConfig = window.sessionStorage.getItem(GAME_CONFIG_DRAFT_KEY);

  if (!storedConfig) {
    return null;
  }

  try {
    return JSON.parse(storedConfig) as GameConfig;
  } catch {
    window.sessionStorage.removeItem(GAME_CONFIG_DRAFT_KEY);

    return null;
  }
}
