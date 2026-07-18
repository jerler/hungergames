import {
  createContext,
  type ReactNode,
  type SetStateAction,
  type Dispatch,
  useContext,
  useMemo,
  useState,
} from "react";

import type { GameState } from "~/game/types/game-state";

interface GameSessionContextValue {
  activeGame: GameState | null;
  setActiveGame: Dispatch<SetStateAction<GameState | null>>;
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

interface GameSessionProviderProps {
  children: ReactNode;
}

export function GameSessionProvider({ children }: GameSessionProviderProps) {
  const [activeGame, setActiveGame] = useState<GameState | null>(null);

  const contextValue = useMemo(
    () => ({
      activeGame,
      setActiveGame,
    }),
    [activeGame],
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
