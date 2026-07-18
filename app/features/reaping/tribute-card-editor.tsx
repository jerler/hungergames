import type { TributeDraft, TributeStats, TributeStatValue } from "~/game/types/tribute";

import { StarRating } from "./star-rating";

interface TributeCardEditorProps {
  tribute: TributeDraft;
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

export function TributeCardEditor({ tribute, onChange, onRandomize }: TributeCardEditorProps) {
  const updateStat = (stat: keyof TributeStats, value: TributeStatValue) => {
    onChange({
      ...tribute,
      stats: {
        ...tribute.stats,
        [stat]: value,
      },
    });
  };

  const tributeLabel = tribute.name.trim()
    ? tribute.name
    : `District ${tribute.district}, tribute ${tribute.districtPosition}`;

  return (
    <article className="tribute-card">
      <header className="tribute-card__header">
        <span>Tribute {tribute.districtPosition}</span>

        <button
          className="tribute-card__randomize"
          type="button"
          aria-label={`Randomize ${tributeLabel}`}
          title="Randomize this tribute"
          onClick={onRandomize}
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
          onChange={(event) => {
            onChange({
              ...tribute,
              name: event.currentTarget.value,
            });
          }}
        />

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
      </div>
    </article>
  );
}
