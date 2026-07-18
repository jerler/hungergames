import {
  DEFAULT_GIFT_FREQUENCIES,
  type GiftDefinitionId,
  type GiftFrequency,
} from "../gifts/gift-definitions";

export type DistrictCount = 6 | 12;

export interface GameConfig {
  districtCount: DistrictCount;
  giftsEnabled: boolean;
  audienceEnabled: boolean;
  giftVoteDurationSeconds: number;
  giftFrequencies: Record<GiftDefinitionId, GiftFrequency>;
}

export function createDefaultGameConfig(): GameConfig {
  return {
    districtCount: 12,
    giftsEnabled: true,
    audienceEnabled: false,
    giftVoteDurationSeconds: 60,
    giftFrequencies: {
      ...DEFAULT_GIFT_FREQUENCIES,
    },
  };
}
