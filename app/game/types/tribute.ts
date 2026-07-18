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
  portraitUrl: string | null;
  stats: TributeStats;
}

// Editable slot in the reaping
export interface TributeDraft {
  id: string;
  district: number;
  districtPosition: 1 | 2;

  sourceDefinitionId: string | null;

  name: string;
  portraitPreviewUrl: string | null;
  stats: TributeStats;
}
