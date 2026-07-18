import type { GameState } from "~/game/types/game-state";

export type GameAction =
  | {
      type: "game/loaded";
      game: GameState;
    }
  | {
      type: "round/began";
      now: string;
    }
  | {
      type: "event/revealed";
      now: string;
    }
  | {
      type: "round/revealed";
      now: string;
    }
  | {
      type: "statistics/opened";
      now: string;
    }
  | {
      type: "game/reset";
    };
