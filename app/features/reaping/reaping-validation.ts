import type { DistrictCount } from "~/game/types/game-config";
import type { TributeDraft } from "~/game/types/tribute";

export interface TributeDraftValidationErrors {
  name?: string;
  stats?: string;
}

export interface ReapingValidationResult {
  isValid: boolean;
  summaryErrors: string[];
  tributeErrors: Record<string, TributeDraftValidationErrors>;
}

function areStatsValid(tribute: TributeDraft): boolean {
  return Object.values(tribute.stats).every(
    (stat) => Number.isInteger(stat) && stat >= 1 && stat <= 5,
  );
}

export function validateTributeDrafts(
  tributes: readonly TributeDraft[],
  districtCount: DistrictCount,
): ReapingValidationResult {
  const expectedTributeCount = districtCount * 2;
  const summaryErrors: string[] = [];
  const tributeErrors: Record<string, TributeDraftValidationErrors> = {};

  if (tributes.length !== expectedTributeCount) {
    summaryErrors.push(`These Games require exactly ${expectedTributeCount} tributes.`);
  }

  const occupiedSlots = new Set<string>();
  let incompleteNameCount = 0;

  for (const tribute of tributes) {
    const slotKey = `${tribute.district}-${tribute.districtPosition}`;
    const errors: TributeDraftValidationErrors = {};

    if (
      tribute.district < 1 ||
      tribute.district > districtCount ||
      ![1, 2].includes(tribute.districtPosition)
    ) {
      summaryErrors.push(`Tribute slot ${tribute.id} has an invalid district assignment.`);
    }

    if (occupiedSlots.has(slotKey)) {
      summaryErrors.push(
        `District ${tribute.district}, tribute ${tribute.districtPosition} is assigned more than once.`,
      );
    }

    occupiedSlots.add(slotKey);

    if (tribute.name.trim().length === 0) {
      errors.name = "Enter a name for this tribute.";
      incompleteNameCount += 1;
    }

    if (!areStatsValid(tribute)) {
      errors.stats = "Brains, Brawn, and Luck must each be between one and five.";
    }

    if (Object.keys(errors).length > 0) {
      tributeErrors[tribute.id] = errors;
    }
  }

  for (let district = 1; district <= districtCount; district += 1) {
    for (let districtPosition = 1; districtPosition <= 2; districtPosition += 1) {
      const slotKey = `${district}-${districtPosition}`;

      if (!occupiedSlots.has(slotKey)) {
        summaryErrors.push(`District ${district}, tribute ${districtPosition} is missing.`);
      }
    }
  }

  if (incompleteNameCount > 0) {
    summaryErrors.unshift(
      `${incompleteNameCount} ${
        incompleteNameCount === 1 ? "tribute needs" : "tributes need"
      } a name.`,
    );
  }

  return {
    isValid: summaryErrors.length === 0 && Object.keys(tributeErrors).length === 0,
    summaryErrors,
    tributeErrors,
  };
}
