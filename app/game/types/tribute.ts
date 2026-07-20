import type { PronounSetId } from "~/game/tributes/pronouns";

export type TributeStatValue = 1 | 2 | 3 | 4 | 5;

export interface TributeStats {
  brains: TributeStatValue;
  brawn: TributeStatValue;
  luck: TributeStatValue;
}

// Predefined character
export interface TributeDefinition {
  id: string;
  name: string;
  pronouns: PronounSetId;
  portraitUrl: string | null;
  portraitPosition?: PortraitPosition;
  stats: TributeStats;
}

// Editable slot in the reaping
export interface TributeDraft {
  id: string;
  district: number;
  districtPosition: 1 | 2;

  sourceDefinitionId: string | null;

  name: string;
  pronouns: PronounSetId;
  portraitPreviewUrl: string | null;
  stats: TributeStats;

  portraitPosition?: PortraitPosition;
}

export interface PortraitPosition {
  x: number;
  y: number;
}
