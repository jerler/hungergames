import type { TributeStatValue } from "~/game/types/tribute";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

interface StarRatingProps {
  id: string;
  label: string;
  value: TributeStatValue;
  onChange: (value: TributeStatValue) => void;
}

export function StarRating({ id, label, value, onChange }: StarRatingProps) {
  return (
    <fieldset className="star-rating">
      <legend className="star-rating__label">{label}</legend>

      <div className="star-rating__options">
        {STAR_VALUES.map((starValue) => {
          const inputId = `${id}-${starValue}`;

          return (
            <span className="star-rating__option" key={starValue}>
              <input
                id={inputId}
                className="star-rating__input"
                type="radio"
                name={id}
                value={starValue}
                checked={value === starValue}
                aria-label={`${starValue} out of 5 stars`}
                onChange={() => {
                  onChange(starValue);
                }}
              />

              <label
                className={[
                  "star-rating__star",
                  starValue <= value ? "star-rating__star--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                htmlFor={inputId}
                title={`${starValue} out of 5`}
              >
                <span aria-hidden="true">★</span>
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
