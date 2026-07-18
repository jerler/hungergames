import { type ChangeEvent, useState } from "react";

import type { TributeDraftValidationErrors } from "~/features/reaping/reaping-validation";
import { PORTRAIT_ACCEPT_ATTRIBUTE, readPortraitFile } from "~/features/reaping/portrait-file";
import type { TributeDraft, TributeStats, TributeStatValue } from "~/game/types/tribute";

import { StarRating } from "./star-rating";

interface TributeCardEditorProps {
  tribute: TributeDraft;
  validationErrors?: TributeDraftValidationErrors;
  onChange: (tribute: TributeDraft) => void;
  onRandomize: () => void;
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart[0]?.toUpperCase())
    .join("");

  return initials || "?";
}

export function TributeCardEditor({
  tribute,
  validationErrors,
  onChange,
  onRandomize,
}: TributeCardEditorProps) {
  const [portraitError, setPortraitError] = useState<string | null>(null);

  const tributeLabel = tribute.name.trim()
    ? tribute.name
    : `District ${tribute.district}, tribute ${tribute.districtPosition}`;

  const nameErrorId = `${tribute.id}-name-error`;
  const portraitErrorId = `${tribute.id}-portrait-error`;

  const updateStat = (stat: keyof TributeStats, value: TributeStatValue) => {
    onChange({
      ...tribute,
      stats: {
        ...tribute.stats,
        [stat]: value,
      },
    });
  };

  const handlePortraitSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    input.value = "";

    if (!file) {
      return;
    }

    setPortraitError(null);

    try {
      const portraitPreviewUrl = await readPortraitFile(file);

      onChange({
        ...tribute,
        portraitPreviewUrl,
      });
    } catch (error) {
      setPortraitError(
        error instanceof Error ? error.message : "The selected portrait could not be read.",
      );
    }
  };

  return (
    <article
      className={["tribute-card", validationErrors ? "tribute-card--invalid" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="tribute-card__header">
        <span>Tribute {tribute.districtPosition}</span>

        <button
          className="tribute-card__randomize"
          type="button"
          aria-label={`Randomize ${tributeLabel}`}
          title="Randomize this tribute"
          onClick={() => {
            setPortraitError(null);
            onRandomize();
          }}
        >
          <span aria-hidden="true">⚄</span>
        </button>
      </header>

      <div className="tribute-card__portrait">
        {tribute.portraitPreviewUrl ? (
          <img src={tribute.portraitPreviewUrl} alt="" />
        ) : (
          <span aria-hidden="true">{getInitials(tribute.name)}</span>
        )}
      </div>

      <div className="tribute-card__portrait-controls">
        <label className="portrait-upload">
          <input
            className="visually-hidden"
            type="file"
            accept={PORTRAIT_ACCEPT_ATTRIBUTE}
            aria-label={`Upload portrait for ${tributeLabel}`}
            aria-describedby={portraitError ? portraitErrorId : undefined}
            onChange={(event) => {
              void handlePortraitSelection(event);
            }}
          />

          <span>{tribute.portraitPreviewUrl ? "Replace portrait" : "Add portrait"}</span>
        </label>

        {tribute.portraitPreviewUrl ? (
          <button
            className="portrait-remove"
            type="button"
            onClick={() => {
              setPortraitError(null);

              onChange({
                ...tribute,
                portraitPreviewUrl: null,
              });
            }}
          >
            Remove
          </button>
        ) : null}
      </div>

      <p className="portrait-help">JPEG, PNG, or WebP. Maximum 5 MB.</p>

      {portraitError ? (
        <p className="tribute-card__field-error" id={portraitErrorId} role="alert">
          {portraitError}
        </p>
      ) : null}

      <div className="tribute-card__details">
        <label className="tribute-card__name-label" htmlFor={`${tribute.id}-name`}>
          Tribute name
        </label>

        <input
          id={`${tribute.id}-name`}
          className="tribute-card__name"
          type="text"
          value={tribute.name}
          maxLength={60}
          placeholder="Enter a name"
          aria-invalid={Boolean(validationErrors?.name)}
          aria-describedby={validationErrors?.name ? nameErrorId : undefined}
          onChange={(event) => {
            onChange({
              ...tribute,
              name: event.currentTarget.value,
            });
          }}
        />

        {validationErrors?.name ? (
          <p className="tribute-card__field-error" id={nameErrorId}>
            {validationErrors.name}
          </p>
        ) : null}

        <div className="tribute-card__stats">
          <StarRating
            id={`${tribute.id}-brains`}
            label="Brains"
            value={tribute.stats.brains}
            onChange={(value) => {
              updateStat("brains", value);
            }}
          />

          <StarRating
            id={`${tribute.id}-brawn`}
            label="Brawn"
            value={tribute.stats.brawn}
            onChange={(value) => {
              updateStat("brawn", value);
            }}
          />

          <StarRating
            id={`${tribute.id}-luck`}
            label="Luck"
            value={tribute.stats.luck}
            onChange={(value) => {
              updateStat("luck", value);
            }}
          />
        </div>

        {validationErrors?.stats ? (
          <p className="tribute-card__field-error">{validationErrors.stats}</p>
        ) : null}
      </div>
    </article>
  );
}
