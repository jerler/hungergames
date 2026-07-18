import type { DistrictCount } from "~/game/types/game-config";
import type { TributeAssignmentMode } from "~/game/tributes/tribute-drafts";

interface ReapingModePickerProps {
  districtCount: DistrictCount;
  onSelect: (mode: TributeAssignmentMode) => void;
}

export function ReapingModePicker({ districtCount, onSelect }: ReapingModePickerProps) {
  const tributeCount = districtCount * 2;

  return (
    <section className="reaping-mode" aria-labelledby="reaping-mode-title">
      <header className="reaping-mode__header">
        <p className="eyebrow">The Reaping</p>

        <h1 className="reaping-mode__title" id="reaping-mode-title">
          Choose your tributes
        </h1>

        <p>
          These Games require {tributeCount} tributes from {districtCount} districts.
        </p>
      </header>

      <div className="reaping-mode__options">
        <button
          className="reaping-mode-option"
          type="button"
          onClick={() => {
            onSelect("random");
          }}
        >
          <span className="reaping-mode-option__icon" aria-hidden="true">
            ⚄
          </span>

          <span className="reaping-mode-option__copy">
            <strong>Random Reaping</strong>

            <span>
              Fill every district with unique predefined tributes. You can edit or reroll anyone
              afterward.
            </span>
          </span>

          <span className="reaping-mode-option__arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button
          className="reaping-mode-option"
          type="button"
          onClick={() => {
            onSelect("manual");
          }}
        >
          <span className="reaping-mode-option__icon" aria-hidden="true">
            ✎
          </span>

          <span className="reaping-mode-option__copy">
            <strong>Manual Reaping</strong>

            <span>Begin with blank tribute cards and configure every participant yourself.</span>
          </span>

          <span className="reaping-mode-option__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </section>
  );
}
