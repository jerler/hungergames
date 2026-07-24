import { createContext, type ReactNode, useCallback, useContext, useMemo, useReducer } from "react";

import type { GameAction } from "~/state/game-actions";
import { gameReducer, type GameReducerState } from "~/state/game-reducer";

interface GameSessionContextValue {
  activeGame: GameReducerState;
  dispatch: React.Dispatch<GameAction>;
  loadGame: (game: unknown) => void;
  resetGame: () => void;
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

interface GameSessionProviderProps {
  children: ReactNode;
}

export function GameSessionProvider({ children }: GameSessionProviderProps) {
  const [activeGame, dispatch] = useReducer(gameReducer, null);

  const loadGame = useCallback((game: unknown) => {
    dispatch({
      type: "game/loaded",
      game,
    });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({
      type: "game/reset",
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      activeGame,
      dispatch,
      loadGame,
      resetGame,
    }),
    [activeGame, loadGame, resetGame],
  );

  return <GameSessionContext.Provider value={contextValue}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSessionContextValue {
  const context = useContext(GameSessionContext);

  if (!context) {
    throw new Error("useGameSession must be used inside GameSessionProvider.");
  }

  return context;
}
