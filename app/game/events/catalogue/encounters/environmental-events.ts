import { selectRandomItem, type RandomSource } from "~/game/engine/random";
import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import {
  acquireNaturalResource,
  always,
  applyStatus,
  createEvent,
  createSelectedRoleItemUseChanges,
  customResolution,
  eliminate,
  getSelectedRoleItem,
  maximumStat,
  result,
  survived,
} from "~/game/events/authoring";
import type { EventResult } from "~/game/events/authoring/outcomes/outcome-schema";
import type { StatCheckOutcome } from "~/game/events/event-outcomes";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameTribute } from "~/game/types/game-state";
import { getEffectiveLuck } from "~/game/engine/effective-stats";

const ARENA_GOOSE_RESULTS = {
  criticalWithFood: result({
    text: ({ tribute }) =>
      `${tribute.name} loses some food to an arena goose, which then decides to pursue ${tribute.pronouns.object} across the arena.`,
    effects: [applyStatus("tribute", "hunted", 2)],
  }),

  criticalWithoutFood: result({
    text: ({ tribute }) =>
      `An arena goose decides ${tribute.name} owes it food and begins relentlessly tracking ${tribute.pronouns.object}.`,
    effects: [applyStatus("tribute", "hunted", 2)],
  }),

  failure: result({
    text: ({ tribute }) =>
      `${tribute.name} spends hours fleeing an arena goose and collapses from exhaustion.`,
    effects: [applyStatus("tribute", "exhausted", 1)],
  }),

  success: result({
    text: ({ tribute }) =>
      `${tribute.name} stands ${tribute.pronouns.possessiveAdjective} ground against an arena goose. After a tense silence, both parties retreat.`,
    effects: [survived("tribute")],
  }),

  exceptionalSuccess: result({
    text: ({ tribute }) =>
      `${tribute.name} befriends an arena goose, which leads ${tribute.pronouns.object} to a patch of edible plants.`,
    effects: [acquireNaturalResource("tribute", "food"), survived("tribute")],
  }),
} as const;

const BRUSHFIRE_RESULTS = {
  criticalFailure: result({
    append: ", but is badly burned before reaching safety.",
    effects: [applyStatus("tribute", "burned", 2)],
  }),

  failure: result({
    append: " and escapes with painful burns.",
    effects: [applyStatus("tribute", "burned", 1)],
  }),

  success: result({
    append: " and successfully reaches the far side.",
    effects: [survived("tribute")],
  }),

  exceptionalFood: result({
    append: ", reaches safety, and discovers a patch of edible plants beyond the burned ground.",
    effects: [acquireNaturalResource("tribute", "food"), survived("tribute")],
  }),

  exceptionalWater: result({
    append: ", reaches safety, and discovers a clean stream beyond the burned ground.",
    effects: [acquireNaturalResource("tribute", "water"), survived("tribute")],
  }),
} as const;

function getArenaGooseResult(outcome: StatCheckOutcome, hasFood: boolean): EventResult {
  switch (outcome) {
    case "critical-failure":
      return hasFood
        ? ARENA_GOOSE_RESULTS.criticalWithFood
        : ARENA_GOOSE_RESULTS.criticalWithoutFood;
    case "failure":
      return ARENA_GOOSE_RESULTS.failure;
    case "success":
      return ARENA_GOOSE_RESULTS.success;
    case "exceptional-success":
      return ARENA_GOOSE_RESULTS.exceptionalSuccess;
  }
}

function getBrushfireResult(outcome: StatCheckOutcome, random: RandomSource): EventResult {
  switch (outcome) {
    case "critical-failure":
      return BRUSHFIRE_RESULTS.criticalFailure;
    case "failure":
      return BRUSHFIRE_RESULTS.failure;
    case "success":
      return BRUSHFIRE_RESULTS.success;
    case "exceptional-success":
      return selectRandomItem(
        [BRUSHFIRE_RESULTS.exceptionalFood, BRUSHFIRE_RESULTS.exceptionalWater],
        random,
      );
  }
}

function getBrushfireDifficultyReduction(itemId?: ItemDefinitionId): number {
  return itemId === "water" ? 2 : itemId ? 1 : 0;
}

function getBrushfireIntro(tribute: GameTribute, itemId?: ItemDefinitionId): string {
  const pronouns = getTributePronouns(tribute);

  switch (itemId) {
    case "water":
      return `${tribute.snapshot.name} uses ${pronouns.possessiveAdjective} water to clear a path through the flames`;
    case "blanket":
      return `${tribute.snapshot.name} wraps ${pronouns.reflexive} in a blanket and smothers the embers`;
    case "shield":
      return `${tribute.snapshot.name} uses ${pronouns.possessiveAdjective} shield against the sparks and falling debris`;
    default:
      return `${tribute.snapshot.name} runs through the brushfire without protection`;
  }
}

export const ENVIRONMENTAL_EVENTS = [
  /* Day Only */
  createEvent("poisonous-berries")
    .solo("victim", {
      getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brains),
    })
    .when(maximumStat("victim", "brains", 4))
    .category("fatal")
    .tags("fatal", "hazard")
    .during("day")
    .weight(2)
    .resolve(
      always(
        result({
          text: ({ victim }) => `${victim.name} mistakes poisonous berries for food.`,

          effects: [
            eliminate("victim", {
              causeId: "poisonous-berries",
              causeLabel: "Poisoned",
            }),
          ],
        }),
      ),
    ),

  createEvent("river-current")
    .solo("victim", {
      getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brawn),
    })
    .when(maximumStat("victim", "brawn", 4))
    .category("fatal")
    .tags("fatal", "hazard")
    .during("day")
    .weight(2)
    .resolve(
      always(
        result({
          text: ({ victim }) => `${victim.name} is swept away while crossing a violent river.`,

          effects: [
            eliminate("victim", {
              causeId: "river-current",
              causeLabel: "Drowned",
            }),
          ],
        }),
      ),
    ),

  createEvent("rough-terrain")
    .solo("tribute", { getWeight: getVulnerabilityWeight })
    .category("hazard")
    .tags("hazard", "status", "environment")
    .during("day")
    .weight(6)
    .resolve(
      always(
        result({
          text: ({ tribute }) => `${tribute.name} is injured while crossing rough terrain.`,
          effects: [applyStatus("tribute", "injured", 1)],
        }),
      ),
    ),

  createEvent("contaminated-water")
    .solo("tribute", { getWeight: getVulnerabilityWeight })
    .category("hazard")
    .tags("hazard", "status", "environment")
    .during("day")
    .weight(5)
    .resolve(
      always(
        result({
          text: ({ tribute }) =>
            `${tribute.name} drinks contaminated water and becomes dehydrated.`,
          effects: [applyStatus("tribute", "dehydrated", 2)],
        }),
      ),
    ),

  createEvent("arena-goose")
    .solo("tribute", {
      getWeight: getVulnerabilityWeight,
      optionalItem: { definitionIds: ["food"] },
    })
    .category("hazard")
    .tags("hazard", "status", "resource")
    .during("day")
    .weight(4.5)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const tribute = requireSingleParticipant(context.participantsByRole, "tribute");
          const food = getSelectedRoleItem(context, "tribute");
          const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 3, context.random);
          const resolution = resolveResult(getArenaGooseResult(outcome, Boolean(food)));

          return outcome === "critical-failure"
            ? {
                ...resolution,
                changes: [
                  ...resolution.changes,
                  ...createSelectedRoleItemUseChanges(context, "tribute", "arena-goose-theft"),
                ],
              }
            : resolution;
        },
        {
          possibleResults: Object.values(ARENA_GOOSE_RESULTS),
        },
      ),
    ),

  createEvent("brushfire-supply-run")
    .solo("tribute", {
      getWeight: getVulnerabilityWeight,
      optionalItem: {
        definitionIds: ["water", "blanket", "shield"],
      },
    })
    .category("hazard")
    .tags("hazard", "environment", "item", "status", "resource")
    .during("day")
    .weight(4)
    .resolve(
      customResolution(
        (context, { resolveResult }) => {
          const tribute = requireSingleParticipant(context.participantsByRole, "tribute");
          const protection = getSelectedRoleItem(context, "tribute");
          const itemId = protection?.item.definitionId;
          const outcome = resolveLuckAdjustedStatCheck(
            tribute,
            "brawn",
            4,
            context.random,
            getBrushfireDifficultyReduction(itemId),
          );

          const resolution = resolveResult(
            getBrushfireResult(outcome, context.random),
            undefined,
            getBrushfireIntro(tribute, itemId),
          );

          return {
            ...resolution,
            changes: [
              ...resolution.changes,
              ...createSelectedRoleItemUseChanges(context, "tribute", "brushfire-protection"),
            ],
          };
        },
        {
          possibleResults: Object.values(BRUSHFIRE_RESULTS),
        },
      ),
    ),
  /* Night Only */
  createEvent("freezing-night")
    .solo("victim", {
      getWeight: getVulnerabilityWeight,
    })
    .when(maximumStat("victim", "brawn", 4))
    .category("fatal")
    .tags("fatal", "hazard")
    .during("night")
    .weight(2.25)
    .resolve(
      always(
        result({
          text: ({ victim }) =>
            `${victim.name} is unable to find shelter and freezes during the night.`,

          effects: [
            eliminate("victim", {
              causeId: "freezing-night",
              causeLabel: "Froze",
            }),
          ],
        }),
      ),
    ),

  createEvent("cold-rain")
    .solo("tribute", { getWeight: getVulnerabilityWeight })
    .category("hazard")
    .tags("hazard", "status", "environment")
    .during("night")
    .weight(6)
    .resolve(
      always(
        result({
          text: ({ tribute }) =>
            `${tribute.name} spends the night shivering through freezing rain and is exhausted by morning.`,
          effects: [applyStatus("tribute", "exhausted", 2)],
        }),
      ),
    ),

  /* Day and Night */
  createEvent("fallen-cliff")
    .solo("victim", {
      getWeight: (tribute) => Math.max(0.25, 6 - getEffectiveLuck(tribute)),
    })
    .category("fatal")
    .tags("fatal", "hazard")
    .during("day", "night")
    .weight(2)
    .resolve(
      always(
        result({
          text: ({ victim }) =>
            `${victim.name} loses their footing near a cliff and falls to their death.`,

          effects: [
            eliminate("victim", {
              causeId: "fallen-cliff",
              causeLabel: "Fell",
            }),
          ],
        }),
      ),
    ),

  createEvent("deep-cut")
    .solo("tribute", { getWeight: getVulnerabilityWeight })
    .category("hazard")
    .tags("hazard", "status")
    .during("day", "night")
    .weight(4)
    .resolve(
      always(
        result({
          text: ({ tribute }) => `${tribute.name} suffers a deep cut and begins bleeding.`,
          effects: [applyStatus("tribute", "bleeding", 2)],
        }),
      ),
    ),
] satisfies readonly EventDefinition[];
