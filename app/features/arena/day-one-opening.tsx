interface DayOneOpeningProps {
  tributeCount: number;
  onFireCannon: () => void;
}

export function DayOneOpening({ tributeCount, onFireCannon }: DayOneOpeningProps) {
  return (
    <section className="bloodbath-opening" aria-labelledby="bloodbath-opening-title">
      <div className="bloodbath-opening__content">
        <div className="bloodbath-opening__seal" aria-hidden="true">
          <img className="bloodbath-opening__seal-image" src="/images/capitol-emblem.webp" alt="" />
        </div>

        <p className="eyebrow">Day 1 · The Bloodbath</p>

        <h1 id="bloodbath-opening-title">The tributes enter the arena.</h1>

        <p className="bloodbath-opening__description">
          The {tributeCount} tributes stand on their platforms, anxiously waiting for the starting cannon.
          In the distance, the great steel Cornucopia overflows with weapons and supplies. Each tribute must choose:
          risk the Bloodbath to gather supplies, or run straight for the trees and survive with whatever
          they can find.
        </p>

        <button className="arena-primary-button" type="button" onClick={onFireCannon}>
          Fire the cannon
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
