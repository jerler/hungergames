import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { loadGameConfigDraft } from "~/features/configuration/game-config-storage";
import { DistrictGrid } from "~/features/reaping/district-grid";
import {
  type ReapingValidationResult,
  validateTributeDrafts,
} from "~/features/reaping/reaping-validation";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import {
  createBlankTributeDrafts,
  createRandomTributeDrafts,
  haveTributeDraftsBeenEdited,
  isTributeDraftBlank,
  randomizeTributeDraft,
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

  const [tributes, setTributes] = useState<TributeDraft[]>(() =>
    config ? createBlankTributeDrafts(config.districtCount) : [],
  );

  const [isRandomizeDialogOpen, setIsRandomizeDialogOpen] = useState(false);

  const randomizeDialogRef = useRef<HTMLDialogElement>(null);

  const [validationResult, setValidationResult] = useState<ReapingValidationResult | null>(null);

  const randomizeBlankTributes = () => {
    setValidationResult(null);

    setTributes((currentTributes) => {
      let updatedTributes = [...currentTributes];

      for (const tribute of currentTributes) {
        if (isTributeDraftBlank(tribute)) {
          updatedTributes = randomizeTributeDraft(updatedTributes, tribute.id);
        }
      }

      return updatedTributes;
    });
  };

  useEffect(() => {
    const dialog = randomizeDialogRef.current;

    if (!dialog) {
      return;
    }

    if (isRandomizeDialogOpen && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!isRandomizeDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [isRandomizeDialogOpen]);

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

  const blankTributeCount = tributes.filter(isTributeDraftBlank).length;

  const randomizeAllTributes = () => {
    setTributes(createRandomTributeDrafts(config.districtCount));

    setValidationResult(null);
    setIsRandomizeDialogOpen(false);
  };

  const requestRandomizeAllTributes = () => {
    if (haveTributeDraftsBeenEdited(tributes)) {
      setIsRandomizeDialogOpen(true);
      return;
    }

    randomizeAllTributes();
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

    const initialGameState = createInitialGameState(config, tributes, "manual");

    loadGame(initialGameState);

    void navigate(`/games/${initialGameState.id}/play`);
  };

  return (
    <div className="reaping-page">
      <header className="reaping-header">
        <Link className="reaping-header__brand" to="/">
          <span aria-hidden="true">
            <img className="app-brand__emblem-image" src="/images/capitol-emblem.webp" alt="" />
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
                Create each tribute yourself, randomize the full roster, or use the dice to replace
                individual characters.
              </p>
            </div>
          </header>

          <div className="reaping-action-bar" aria-label="Tribute roster actions">
            <div className="reaping-action-bar__secondary">
              <button
                className="reaping-action-button"
                type="button"
                onClick={requestRandomizeAllTributes}
              >
                Randomize all
              </button>

              <button
                className="reaping-action-button"
                type="button"
                disabled={blankTributeCount === 0}
                onClick={randomizeBlankTributes}
              >
                Randomize blanks
                {blankTributeCount > 0 ? ` (${blankTributeCount})` : ""}
              </button>
            </div>

            <div className="reaping-action-bar__primary">
              <button className="start-games-button" type="submit">
                Start the Games
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

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
            <button className="start-games-button" type="submit">
              Start the Games
              <span aria-hidden="true">→</span>
            </button>
          </footer>
        </form>
      </main>
      <dialog
        ref={randomizeDialogRef}
        className="reaping-randomize-dialog"
        aria-labelledby="randomize-dialog-title"
        aria-describedby="randomize-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          setIsRandomizeDialogOpen(false);
        }}
        onClose={() => {
          setIsRandomizeDialogOpen(false);
        }}
      >
        <div className="reaping-randomize-dialog__content">
          <p className="eyebrow">Replace the roster</p>

          <h2 id="randomize-dialog-title">Randomize all tributes?</h2>

          <p id="randomize-dialog-description">
            This will replace every tribute with a random predefined character. Names, portraits,
            pronouns, and stats you have changed will be lost.
          </p>

          <div className="reaping-randomize-dialog__actions">
            <button
              className="reaping-dialog-button reaping-dialog-button--secondary"
              type="button"
              onClick={() => {
                setIsRandomizeDialogOpen(false);
              }}
            >
              Keep my changes
            </button>

            <button
              className="reaping-dialog-button reaping-dialog-button--primary"
              type="button"
              onClick={randomizeAllTributes}
            >
              Randomize all tributes
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
