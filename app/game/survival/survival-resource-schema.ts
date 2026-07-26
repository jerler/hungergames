import type { SurvivalNeed } from "./survival-schema";

export const FOOD_RESOURCE_IDS = [
  "wild-fruit",
  "mushrooms",
  "eggs",
  "rabbit",
  "chicken",
  "fish",
] as const;

export type FoodResourceId = (typeof FOOD_RESOURCE_IDS)[number];

export const LEGACY_FOOD_WATER_ITEM_IDS = [
  "water",
  ...FOOD_RESOURCE_IDS,
  "soup",
  "pizza-box",
  "bottled-water",
] as const;

export type LegacyFoodWaterItemId = (typeof LEGACY_FOOD_WATER_ITEM_IDS)[number];

const LEGACY_FOOD_WATER_ITEM_ID_SET = new Set<string>(LEGACY_FOOD_WATER_ITEM_IDS);

export function isLegacyFoodWaterItemId(value: unknown): value is LegacyFoodWaterItemId {
  return typeof value === "string" && LEGACY_FOOD_WATER_ITEM_ID_SET.has(value);
}

export function getSurvivalNeedForFoodResource(resourceId: FoodResourceId): SurvivalNeed {
  void resourceId;
  return "food";
}
