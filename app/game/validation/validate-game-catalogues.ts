import { BLOODBATH_EVENT_CATALOGUE } from "~/game/events/catalogue/bloodbath";

import { validateCornucopiaItemPools } from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";

import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";

import { EVENT_CATALOGUE } from "~/game/events/catalogue";

import { validateEventCatalogues } from "~/game/events/validation/validate-event-catalogues";

import { ITEM_CATALOGUE } from "~/game/items/item-catalogue";

import { validateItemCatalogue } from "~/game/items/item-validation";

import { STATUS_CATALOGUE } from "~/game/statuses/status-catalogue";

import { validateStatusCatalogue } from "~/game/statuses/status-validation";

export function validateGameCatalogues(): void {
  /*
   * Validation order follows dependency order:
   *
   * statuses ← items ← events and acquisition pools
   */
  validateStatusCatalogue(STATUS_CATALOGUE);

  validateItemCatalogue(ITEM_CATALOGUE);

  validateEventCatalogues({
    ordinaryCatalogue: EVENT_CATALOGUE,

    bloodbathCatalogue: BLOODBATH_EVENT_CATALOGUE,

    ordinaryFamilies: ORDINARY_EVENT_CATALOGUE_FAMILIES,

    bloodbathFamilies: BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  });

  validateCornucopiaItemPools();
}
