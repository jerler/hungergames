import { useState } from "react";
import { Link, useLocation } from "react-router";

import { loadGameConfigDraft } from "~/features/configuration/game-config-storage";
import { DistrictGrid } from "~/features/reaping/district-grid";
import { ReapingModePicker } from "~/features/reaping/reaping-mode-picker";
import {
  createBlankTributeDrafts,
  createRandomTributeDrafts,
  randomizeTributeDraft,
  type TributeAssignmentMode,
} from "~/game/tributes/tribute-drafts";
import type { GameConfig } from "~/game/types/game-config";
import type { TributeDraft } from "~/game/types/tribute";

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

  const navigationConfig = (location.state as ReapingLocationState | null)?.config;

  const [config] = useState<GameConfig | null>(() => navigationConfig ?? loadGameConfigDraft());

  const [assignmentMode, setAssignmentMode] = useState<TributeAssignmentMode | null>(null);

  const [tributes, setTributes] = useState<TributeDraft[]>([]);

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

    setTributes(
      mode === "random"
        ? createRandomTributeDrafts(config.districtCount)
        : createBlankTributeDrafts(config.districtCount),
    );
  };

  const updateTribute = (updatedTribute: TributeDraft) => {
    setTributes((currentTributes) =>
      currentTributes.map((tribute) =>
        tribute.id === updatedTribute.id ? updatedTribute : tribute,
      ),
    );
  };

  const randomizeTribute = (tributeId: string) => {
    setTributes((currentTributes) => randomizeTributeDraft(currentTributes, tributeId));
  };

  if (!assignmentMode) {
    return (
      <div className="reaping-page">
        <header className="reaping-header">
          <Link className="reaping-header__brand" to="/">
            <span aria-hidden="true">XII</span>
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
          <span aria-hidden="true">XII</span>
          <span>Hunger Games Simulator</span>
        </Link>

        <p>
          {config.districtCount} districts · {config.districtCount * 2} tributes
        </p>
      </header>

      <main className="reaping-main">
        <header className="reaping-editor-header">
          <div>
            <p className="eyebrow">The Reaping</p>

            <h1>Prepare the tributes</h1>

            <p>Edit each tribute or use the dice to replace an individual character.</p>
          </div>

          <button
            className="reaping-change-mode"
            type="button"
            onClick={() => {
              setAssignmentMode(null);
              setTributes([]);
            }}
          >
            Change assignment method
          </button>
        </header>

        <DistrictGrid
          districtCount={config.districtCount}
          tributes={tributes}
          onTributeChange={updateTribute}
          onTributeRandomize={randomizeTribute}
        />
      </main>
    </div>
  );
}
