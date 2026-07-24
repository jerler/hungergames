export type GameAction =
  | {
      type: "game/loaded";
      game: unknown;
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
