import { type FormEvent, useState } from "react";

import {
  GIFT_DEFINITIONS,
  GIFT_FREQUENCY_OPTIONS,
  type GiftDefinitionId,
  type GiftFrequency,
} from "~/game/gifts/gift-definitions";
import {
  createDefaultGameConfig,
  type DistrictCount,
  type GameConfig,
} from "~/game/types/game-config";

interface GameConfigurationFormProps {
  initialConfig?: GameConfig;
  onSubmit: (config: GameConfig) => void;
}

export function validateGameConfig(config: GameConfig): string[] {
  const errors: string[] = [];

  if (
    !Number.isFinite(config.giftVoteDurationSeconds) ||
    config.giftVoteDurationSeconds < 15 ||
    config.giftVoteDurationSeconds > 300
  ) {
    errors.push("Audience voting must last between 15 seconds and 5 minutes.");
  }

  if (config.audienceEnabled && !config.giftsEnabled) {
    errors.push("Audience participation cannot be enabled when tribute gifts are disabled.");
  }

  if (
    config.giftsEnabled &&
    Object.values(config.giftFrequencies).every((frequency) => frequency === "disabled")
  ) {
    errors.push("Enable at least one gift before continuing.");
  }

  return errors;
}

export function GameConfigurationForm({ initialConfig, onSubmit }: GameConfigurationFormProps) {
  const [config, setConfig] = useState<GameConfig>(() => {
    if (!initialConfig) {
      return createDefaultGameConfig();
    }

    return {
      ...initialConfig,
      giftFrequencies: {
        ...initialConfig.giftFrequencies,
      },
    };
  });

  const [voteDurationInput, setVoteDurationInput] = useState(() =>
    String(initialConfig?.giftVoteDurationSeconds ?? 60),
  );

  const [formErrors, setFormErrors] = useState<string[]>([]);

  const updateDistrictCount = (districtCount: DistrictCount) => {
    setConfig((currentConfig) => ({
      ...currentConfig,
      districtCount,
    }));
  };

  const updateGiftsEnabled = (giftsEnabled: boolean) => {
    setConfig((currentConfig) => ({
      ...currentConfig,
      giftsEnabled,
      audienceEnabled: giftsEnabled ? currentConfig.audienceEnabled : false,
    }));
  };

  const updateAudienceEnabled = (audienceEnabled: boolean) => {
    setConfig((currentConfig) => ({
      ...currentConfig,
      audienceEnabled,
    }));
  };

  const updateGiftFrequency = (giftId: GiftDefinitionId, frequency: GiftFrequency) => {
    setConfig((currentConfig) => ({
      ...currentConfig,
      giftFrequencies: {
        ...currentConfig.giftFrequencies,
        [giftId]: frequency,
      },
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedVoteDuration = Number(voteDurationInput);

    const submittedConfig: GameConfig = {
      ...config,
      giftVoteDurationSeconds: parsedVoteDuration,
    };

    const validationErrors = validateGameConfig(submittedConfig);

    setFormErrors(validationErrors);

    if (validationErrors.length > 0) {
      return;
    }

    onSubmit(submittedConfig);
  };

  return (
    <form className="game-configuration" noValidate onSubmit={handleSubmit}>
      <header className="game-configuration__header">
        <p className="eyebrow">Create the Games</p>

        <h1 className="game-configuration__title">Configure your arena</h1>

        <p className="game-configuration__introduction">
          Choose the size of the Games and decide how sponsors may influence the arena.
        </p>
      </header>

      {formErrors.length > 0 ? (
        <div className="configuration-errors" role="alert">
          <h2>Review your configuration</h2>

          <ul>
            {formErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className="configuration-section">
        <legend className="configuration-section__legend">Game size</legend>

        <p className="configuration-section__description">
          Each district contributes two tributes.
        </p>

        <div className="game-size-options">
          <label
            className={[
              "game-size-option",
              config.districtCount === 12 ? "game-size-option--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              className="game-size-option__input"
              type="radio"
              name="districtCount"
              value="12"
              checked={config.districtCount === 12}
              onChange={() => {
                updateDistrictCount(12);
              }}
            />

            <span className="game-size-option__content">
              <strong>Full Games</strong>
              <span>12 districts · 24 tributes</span>
            </span>

            <span className="game-size-option__indicator" aria-hidden="true" />
          </label>

          <label
            className={[
              "game-size-option",
              config.districtCount === 6 ? "game-size-option--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              className="game-size-option__input"
              type="radio"
              name="districtCount"
              value="6"
              checked={config.districtCount === 6}
              onChange={() => {
                updateDistrictCount(6);
              }}
            />

            <span className="game-size-option__content">
              <strong>Half Games</strong>
              <span>6 districts · 12 tributes</span>
            </span>

            <span className="game-size-option__indicator" aria-hidden="true" />
          </label>
        </div>
      </fieldset>

      <section className="configuration-section" aria-labelledby="gift-settings-title">
        <div className="configuration-setting">
          <div className="configuration-setting__copy">
            <h2 id="gift-settings-title">Tribute gifts</h2>

            <p>Allow sponsors to send useful items to living tributes between rounds.</p>
          </div>

          <label className="config-toggle">
            <input
              className="config-toggle__input"
              type="checkbox"
              aria-label="Enable tribute gifts"
              checked={config.giftsEnabled}
              onChange={(event) => {
                updateGiftsEnabled(event.currentTarget.checked);
              }}
            />

            <span className="config-toggle__track" aria-hidden="true">
              <span className="config-toggle__handle" />
            </span>

            <span className="config-toggle__state">
              {config.giftsEnabled ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>

        {config.giftsEnabled ? (
          <>
            <div className="configuration-divider" />

            <div className="configuration-setting">
              <div className="configuration-setting__copy">
                <h3>Audience participation</h3>

                <p>Let an audience vote on gifts and their recipients using a room code.</p>
              </div>

              <label className="config-toggle">
                <input
                  className="config-toggle__input"
                  type="checkbox"
                  aria-label="Enable audience participation"
                  checked={config.audienceEnabled}
                  onChange={(event) => {
                    updateAudienceEnabled(event.currentTarget.checked);
                  }}
                />

                <span className="config-toggle__track" aria-hidden="true">
                  <span className="config-toggle__handle" />
                </span>

                <span className="config-toggle__state">
                  {config.audienceEnabled ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>

            {config.audienceEnabled ? (
              <div className="vote-duration">
                <label htmlFor="vote-duration">Voting time limit</label>

                <div className="vote-duration__input">
                  <input
                    id="vote-duration"
                    name="voteDuration"
                    type="number"
                    min="15"
                    max="300"
                    step="5"
                    value={voteDurationInput}
                    onChange={(event) => {
                      setVoteDurationInput(event.currentTarget.value);
                    }}
                  />

                  <span>seconds</span>
                </div>

                <p>Audience votes may remain open for 15 to 300 seconds.</p>
              </div>
            ) : null}

            <div className="configuration-divider" />

            <div className="gift-frequency-heading">
              <div>
                <h3>Manage gift options</h3>

                <p>Frequency controls how likely each gift is to appear as a possible choice.</p>
              </div>
            </div>

            <div className="gift-frequency-table-wrapper">
              <table className="gift-frequency-table">
                <thead>
                  <tr>
                    <th scope="col">Gift</th>
                    <th scope="col">Frequency</th>
                  </tr>
                </thead>

                <tbody>
                  {GIFT_DEFINITIONS.map((gift) => {
                    const frequency = config.giftFrequencies[gift.id];

                    const isDisabled = frequency === "disabled";

                    return (
                      <tr
                        className={
                          isDisabled
                            ? "gift-frequency-row gift-frequency-row--disabled"
                            : "gift-frequency-row"
                        }
                        key={gift.id}
                      >
                        <th scope="row">
                          <span className="gift-frequency-row__name">{gift.name}</span>

                          <span className="gift-frequency-row__description">
                            {gift.description}
                          </span>
                        </th>

                        <td>
                          <label className="visually-hidden" htmlFor={`gift-frequency-${gift.id}`}>
                            Frequency for {gift.name}
                          </label>

                          <select
                            id={`gift-frequency-${gift.id}`}
                            value={frequency}
                            onChange={(event) => {
                              updateGiftFrequency(
                                gift.id,
                                event.currentTarget.value as GiftFrequency,
                              );
                            }}
                          >
                            {GIFT_FREQUENCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="configuration-disabled-note">
            Sponsor gifts and audience voting will not appear during these Games.
          </p>
        )}
      </section>

      <footer className="game-configuration__footer">
        <p>You can customize every tribute during the Reaping.</p>

        <button className="configuration-submit" type="submit">
          Continue to the Reaping
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </form>
  );
}
