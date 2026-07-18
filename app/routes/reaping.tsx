import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { loadGameConfigDraft } from "~/features/configuration/game-config-storage";
import { DistrictGrid } from "~/features/reaping/district-grid";
import { ReapingModePicker } from "~/features/reaping/reaping-mode-picker";
import {
  type ReapingValidationResult,
  validateTributeDrafts,
} from "~/features/reaping/reaping-validation";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import {
  createBlankTributeDrafts,
  createRandomTributeDrafts,
  randomizeTributeDraft,
  type TributeAssignmentMode,
} from "~/game/tributes/tribute-drafts";
import type { GameConfig } from "~/game/types/game-config";
import type { TributeDraft } from "~/game/types/tribute";
import { useGameSession } from "~/state/game-session-context";

interface ReapingLocationState {
  config?: GameConfig;
}

export function meta() {
  return [
    {
      title: "The Reaping | Hunger Games Simulator",
    },
  ];
}

export default function ReapingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loadGame } = useGameSession();

  const navigationConfig = (location.state as ReapingLocationState | null)?.config;

  const [config] = useState<GameConfig | null>(() => navigationConfig ?? loadGameConfigDraft());

  const [assignmentMode, setAssignmentMode] = useState<TributeAssignmentMode | null>(null);

  const [tributes, setTributes] = useState<TributeDraft[]>([]);

  const [validationResult, setValidationResult] = useState<ReapingValidationResult | null>(null);

  if (!config) {
    return (
      <main className="page-shell">
        <section className="content-card">
          <p className="eyebrow">The Reaping</p>

          <h1 className="page-title">Configure the Games first</h1>

          <p className="page-description">No Game configuration was found for this Reaping.</p>

          <Link to="/create">Return to Game configuration</Link>
        </section>
      </main>
    );
  }

  const selectAssignmentMode = (mode: TributeAssignmentMode) => {
    setAssignmentMode(mode);
    setValidationResult(null);

    setTributes(
      mode === "random"
        ? createRandomTributeDrafts(config.districtCount)
        : createBlankTributeDrafts(config.districtCount),
    );
  };

  const updateTribute = (updatedTribute: TributeDraft) => {
    setValidationResult(null);

    setTributes((currentTributes) =>
      currentTributes.map((tribute) =>
        tribute.id === updatedTribute.id ? updatedTribute : tribute,
      ),
    );
  };

  const randomizeTribute = (tributeId: string) => {
    setValidationResult(null);

    setTributes((currentTributes) => randomizeTributeDraft(currentTributes, tributeId));
  };

  const startGames = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!assignmentMode) {
      return;
    }

    const nextValidationResult = validateTributeDrafts(tributes, config.districtCount);

    setValidationResult(nextValidationResult);

    if (!nextValidationResult.isValid) {
      const firstInvalidTributeId = Object.keys(nextValidationResult.tributeErrors)[0];

      window.requestAnimationFrame(() => {
        if (firstInvalidTributeId) {
          document.getElementById(`${firstInvalidTributeId}-name`)?.focus();
        }
      });

      return;
    }

    const initialGameState = createInitialGameState(config, tributes, assignmentMode);

    loadGame(initialGameState);

    void navigate(`/games/${initialGameState.id}/play`);
  };

  if (!assignmentMode) {
    return (
      <div className="reaping-page">
        <header className="reaping-header">
          <Link className="reaping-header__brand" to="/">
            <span aria-hidden="true">
              <img
                className="app-brand__emblem-image"
                src="/images/capitol-emblem.webp"
                alt=""
              />
            </span>
            <span>Hunger Games Simulator</span>
          </Link>

          <p>Step 2 of 2</p>
        </header>

        <main className="reaping-main reaping-main--mode">
          <ReapingModePicker districtCount={config.districtCount} onSelect={selectAssignmentMode} />
        </main>
      </div>
    );
  }

  return (
    <div className="reaping-page">
      <header className="reaping-header">
        <Link className="reaping-header__brand" to="/">
          <span aria-hidden="true">
            <img
              className="app-brand__emblem-image"
              src="/images/capitol-emblem.webp"
              alt=""
            />
          </span>
          <span>Hunger Games Simulator</span>
        </Link>

        <p>
          {config.districtCount} districts · {config.districtCount * 2} tributes
        </p>
      </header>

      <main className="reaping-main">
        <form onSubmit={startGames}>
          <header className="reaping-editor-header">
            <div>
              <p className="eyebrow">The Reaping</p>

              <h1>Prepare the tributes</h1>

              <p>
                Edit every tribute, add portraits, or use the dice to replace individual characters.
              </p>
            </div>

            <button
              className="reaping-change-mode"
              type="button"
              onClick={() => {
                setAssignmentMode(null);
                setTributes([]);
                setValidationResult(null);
              }}
            >
              Change assignment method
            </button>
          </header>

          {validationResult && !validationResult.isValid ? (
            <section className="reaping-errors" aria-labelledby="reaping-errors-title" role="alert">
              <h2 id="reaping-errors-title">Complete the Reaping</h2>

              <ul>
                {validationResult.summaryErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <DistrictGrid
            districtCount={config.districtCount}
            tributes={tributes}
            tributeErrors={validationResult?.tributeErrors ?? {}}
            onTributeChange={updateTribute}
            onTributeRandomize={randomizeTribute}
          />

          <footer className="reaping-editor-footer">
            <p>Portraits are optional. Every tribute must have a name and three completed stats.</p>

            <button className="start-games-button" type="submit">
              Start the Games
              <span aria-hidden="true">→</span>
            </button>
          </footer>
        </form>
      </main>
    </div>
  );
}
