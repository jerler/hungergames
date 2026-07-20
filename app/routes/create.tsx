import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";

import { GameConfigurationForm } from "~/features/configuration/game-configuration-form";
import { saveGameConfigDraft } from "~/features/configuration/game-config-storage";
import { OpeningFanfare } from "~/features/opening/opening-fanfare";
import type { GameConfig } from "~/game/types/game-config";

export function meta() {
  return [
    {
      title: "Create the Games | Hunger Games Simulator",
    },
  ];
}

export default function CreatePage() {
  const navigate = useNavigate();

  const [isOpeningVisible, setIsOpeningVisible] = useState(true);

  const completeOpening = useCallback(() => {
    setIsOpeningVisible(false);
  }, []);

  const handleConfigurationSubmit = useCallback(
    (config: GameConfig) => {
      saveGameConfigDraft(config);
      void navigate("/create/reaping", {
        state: {
          config,
        },
      });
    },
    [navigate],
  );

  if (isOpeningVisible) {
    return <OpeningFanfare onComplete={completeOpening} />;
  }

  return (
    <div className="configuration-page">
      <header className="configuration-header">
        <Link className="configuration-header__brand" to="/">
          <span aria-hidden="true">
            <img className="app-brand__emblem-image" src="/images/capitol-emblem.webp" alt="" />
          </span>
          <span>Hunger Games Simulator</span>
        </Link>

        <p>Step 1 of 2</p>
      </header>

      <main className="configuration-main">
        <GameConfigurationForm onSubmit={handleConfigurationSubmit} />
      </main>
    </div>
  );
}
