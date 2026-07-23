import { describe, expect, it } from "vitest";

import {
  BLOODBATH_EVENT_CATALOGUE,
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import { COMBAT_EVENTS } from "~/game/events/catalogue/encounters/combat-events";
import { ENVIRONMENTAL_EVENTS } from "~/game/events/catalogue/encounters/environmental-events";
import { GAMEMAKER_EVENTS } from "~/game/events/catalogue/encounters/gamemaker-events";
import { ITEM_USE_EVENTS } from "~/game/events/catalogue/encounters/item-use-events";
import { SURVIVAL_EVENTS } from "~/game/events/catalogue/encounters/survival-events";
import { THEFT_EVENTS } from "~/game/events/catalogue/encounters/theft-events";
import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import { ROMANTIC_EVENTS } from "~/game/events/catalogue/relationships/romantic-events";
import { STANDARD_DISSOLUTION_EVENTS } from "~/game/events/catalogue/relationships/standard-dissolution-events";
import { STANDARD_FORMATION_EVENTS } from "~/game/events/catalogue/relationships/standard-formation-events";
import { STANDARD_INTERACTION_EVENTS } from "~/game/events/catalogue/relationships/standard-interaction-events";
import { HIGH_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/high-events";
import { LOW_BRAINS_EVENTS } from "~/game/events/catalogue/stat-gated/brains/low-events";
import { HIGH_BRAWN_EVENTS } from "~/game/events/catalogue/stat-gated/brawn/high-events";
import { LOW_BRAWN_EVENTS } from "~/game/events/catalogue/stat-gated/brawn/low-events";
import { HIGH_LUCK_EVENTS } from "~/game/events/catalogue/stat-gated/luck/high-events";
import { LOW_LUCK_EVENTS } from "~/game/events/catalogue/stat-gated/luck/low-events";
import { MIXED_STAT_GATED_EVENTS } from "~/game/events/catalogue/stat-gated/mixed-events";
import { validateEventCatalogues } from "~/game/events/validation/validate-event-catalogues";

describe("production event catalogues", () => {
  it("contains every exported event exactly once with no cross-catalogue IDs", () => {
    expect(() =>
      validateEventCatalogues({
        ordinaryCatalogue: EVENT_CATALOGUE,

        bloodbathCatalogue: BLOODBATH_EVENT_CATALOGUE,

        ordinaryFamilies: [
          {
            name: "combat",
            events: COMBAT_EVENTS,
          },
          {
            name: "theft",
            events: THEFT_EVENTS,
          },
          {
            name: "environmental",
            events: ENVIRONMENTAL_EVENTS,
          },
          {
            name: "survival",
            events: SURVIVAL_EVENTS,
          },
          {
            name: "item-use",
            events: ITEM_USE_EVENTS,
          },
          {
            name: "gamemaker",
            events: GAMEMAKER_EVENTS,
          },
          {
            name: "high-brains",
            events: HIGH_BRAINS_EVENTS,
          },
          {
            name: "low-brains",
            events: LOW_BRAINS_EVENTS,
          },
          {
            name: "high-brawn",
            events: HIGH_BRAWN_EVENTS,
          },
          {
            name: "low-brawn",
            events: LOW_BRAWN_EVENTS,
          },
          {
            name: "high-luck",
            events: HIGH_LUCK_EVENTS,
          },
          {
            name: "low-luck",
            events: LOW_LUCK_EVENTS,
          },
          {
            name: "mixed-stats",
            events: MIXED_STAT_GATED_EVENTS,
          },
          {
            name: "standard-formation",
            events: STANDARD_FORMATION_EVENTS,
          },
          {
            name: "standard-interaction",
            events: STANDARD_INTERACTION_EVENTS,
          },
          {
            name: "standard-dissolution",
            events: STANDARD_DISSOLUTION_EVENTS,
          },
          {
            name: "romantic",
            events: ROMANTIC_EVENTS,
          },
        ],

        bloodbathFamilies: [
          {
            name: "cornucopia-acquisition",
            events: CORNUCOPIA_ACQUISITION_EVENTS,
          },
          {
            name: "cornucopia-pair-conflict",
            events: CORNUCOPIA_PAIR_CONFLICT_EVENTS,
          },
          {
            name: "cornucopia-group-conflict",
            events: CORNUCOPIA_GROUP_CONFLICT_EVENTS,
          },
          {
            name: "flee",
            events: FLEE_EVENTS,
          },
        ],
      }),
    ).not.toThrow();
  });
});
