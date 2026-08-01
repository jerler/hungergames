import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import {
  applyStatus,
  brains,
  createItemStatEvent,
  result,
  satisfySurvivalNeed,
  survived,
} from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const ITEM_USE_EVENTS = [
  createItemStatEvent("axe-based-shelter-renovation", {
    itemId: "axe",
    check: brains(3),
    tags: ["environment", "weapon", "tool", "item", "status"],
    periods: ["day"],
    weight: 8,
    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} attempts an ambitious shelter renovation, drops part of a tree on ${tribute.pronouns.reflexive}, and destroys the original shelter.`,
        effects: [applyStatus("tribute", "injured", 2)],
      }),
      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} demolishes most of ${tribute.pronouns.possessiveAdjective} shelter before realizing ${tribute.pronouns.subject} had no clear renovation plan.`,
        effects: [applyStatus("tribute", "exhausted", 1)],
      }),
      success: result({
        text: ({ tribute }) =>
          `${tribute.name} uses an axe to construct a sturdy shelter hidden among the trees.`,
        effects: [applyStatus("tribute", "hidden", 1), survived("tribute")],
      }),
      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} transforms a rough shelter into an exceptionally concealed arena hideout.`,
        effects: [
          applyStatus("tribute", "hidden", 2),
          applyStatus("tribute", "inspired", 1),
          survived("tribute"),
        ],
      }),
    },
  }),

  createItemStatEvent("slingshot-trick-shot", {
    itemId: "slingshot",
    check: brains(3),
    tags: ["weapon", "item", "status", "resource"],
    periods: ["day"],
    weight: 4.5,
    recoveryTargets: [
      {
        kind: "survival-need",
        roleId: "tribute",
        need: "food",
      },
    ],
    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} attempts an elaborate ricochet shot and discovers exactly where the stone eventually returns.`,
        effects: [applyStatus("tribute", "injured", 1)],
      }),
      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} misses a trick shot completely and alerts something in the arena to ${tribute.pronouns.possessiveAdjective} location.`,
        effects: [applyStatus("tribute", "hunted", 1)],
      }),
      success: result({
        text: ({ tribute }) =>
          `${tribute.name} uses a careful slingshot shot to knock edible fruit from a high branch and eats it.`,
        effects: [satisfySurvivalNeed("tribute", "food"), survived("tribute")],
      }),
      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} performs an impossible-looking trick shot, eats the fallen fruit, and feels extremely pleased with ${tribute.pronouns.reflexive}.`,
        effects: [
          satisfySurvivalNeed("tribute", "food"),
          applyStatus("tribute", "inspired", 1),
          survived("tribute"),
        ],
      }),
    },
  }),

  createItemStatEvent("shield-used-for-everything-else", {
    itemId: "shield",
    check: brains(3),
    tags: ["tool", "item", "status", "resource"],
    periods: ["day"],
    weight: 3.5,
    roleOptions: { getWeight: getVulnerabilityWeight },
    recoveryTargets: [
      {
        kind: "survival-need",
        roleId: "tribute",
        need: "food",
      },
      {
        kind: "survival-need",
        roleId: "tribute",
        need: "water",
      },
    ],
    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} shield as a sled, discovers an unexpected ravine, and loses all sense of direction.`,
        effects: [applyStatus("tribute", "injured", 1), applyStatus("tribute", "disoriented", 1)],
      }),
      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} spends hours using ${tribute.pronouns.possessiveAdjective} shield as a shovel before becoming firmly stuck in the mud.`,
        effects: [applyStatus("tribute", "exhausted", 1)],
      }),
      success: result({
        text: ({ tribute }) =>
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} shield as a rain catcher and drinks the clean water.`,
        effects: [satisfySurvivalNeed("tribute", "water"), survived("tribute")],
      }),
      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} shield as a sled and glides into a sheltered hollow, where ${tribute.pronouns.subject} eats edible plants and drinks from a clean spring.`,
        effects: [
          satisfySurvivalNeed("tribute", "food"),
          satisfySurvivalNeed("tribute", "water"),
          survived("tribute"),
        ],
      }),
    },
  }),
] satisfies readonly EventDefinition[];
