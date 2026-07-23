import { getForagingScore, getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import {
  acquireNaturalResource,
  applyStatus,
  brains,
  brawn,
  createItemStatEvent,
  result,
  survived,
} from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const ITEM_USE_EVENTS = [
  /* Day Only */

  createItemStatEvent("fishing-gear-enormous-fish", {
    itemId: "fishing-gear",
    check: brawn(3),
    tags: ["tool", "item", "status", "resource"],
    periods: ["day"],
    weight: 3.5,
    roleOptions: { getWeight: getForagingScore },

    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} hooks an enormous fish and is dragged violently through the water before cutting the line.`,
        effects: [applyStatus("tribute", "injured", 1), applyStatus("tribute", "exhausted", 2)],
      }),

      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} battles an enormous fish for hours, only for it to escape at the last possible moment.`,
        effects: [applyStatus("tribute", "exhausted", 1)],
      }),

      success: result({
        text: ({ tribute }) =>
          `${tribute.name} lands an enormous fish and prepares enough food to keep going.`,
        effects: [acquireNaturalResource("tribute", "food"), survived("tribute")],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} lands a legendary arena fish and is briefly overwhelmed by ${tribute.pronouns.possessiveAdjective} own competence.`,
        effects: [
          acquireNaturalResource("tribute", "food"),
          survived("tribute"),
          applyStatus("tribute", "inspired", 2),
        ],
      }),
    },
  }),

  createItemStatEvent("axe-based-shelter-renovation", {
    itemId: "axe",
    check: brains(3),
    tags: ["environment", "weapon", "tool", "item", "status"],
    periods: ["day"],
    weight: 3.5,

    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} attempts an ambitious shelter renovation, drops part of a tree on ${tribute.pronouns.reflexive}, and destroys the original shelter.`,
        effects: [applyStatus("tribute", "injured", 2), applyStatus("tribute", "exposed", 1)],
      }),

      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} demolishes most of ${tribute.pronouns.possessiveAdjective} shelter before realizing ${tribute.pronouns.subject} had no clear renovation plan.`,
        effects: [applyStatus("tribute", "exhausted", 1), applyStatus("tribute", "exposed", 1)],
      }),

      success: result({
        text: ({ tribute }) =>
          `${tribute.name} uses an axe to construct a sturdy shelter hidden among the trees.`,
        effects: [applyStatus("tribute", "concealed", 1), survived("tribute")],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} transforms a rough shelter into an exceptionally concealed arena hideout.`,
        effects: [
          applyStatus("tribute", "concealed", 2),
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
    weight: 3.5,

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
          `${tribute.name} uses a careful slingshot shot to knock edible fruit from a high branch.`,
        effects: [acquireNaturalResource("tribute", "food"), survived("tribute")],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} performs an impossible-looking trick shot, collects the fallen food, and feels extremely pleased with ${tribute.pronouns.reflexive}.`,
        effects: [
          acquireNaturalResource("tribute", "food"),
          applyStatus("tribute", "inspired", 1),
          survived("tribute"),
        ],
      }),
    },
  }),

  /* Night Only */

  /* Day and Night */

  createItemStatEvent("trap-kit-instructions-missing", {
    itemId: "trap-kit",
    check: brains(3),
    tags: ["tool", "item", "status", "resource"],
    periods: ["day", "night"],
    weight: 3.5,
    roleOptions: { getWeight: getForagingScore },

    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} tries to assemble a trap kit without instructions and immediately catches ${tribute.pronouns.reflexive}.`,
        effects: [applyStatus("tribute", "injured", 1)],
      }),

      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} spends hours constructing a trap that repeatedly springs before anything approaches it.`,
        effects: [applyStatus("tribute", "exhausted", 1)],
      }),

      success: result({
        text: ({ tribute }) =>
          `${tribute.name} successfully assembles a trap and catches enough game for a meal.`,
        effects: [acquireNaturalResource("tribute", "food"), survived("tribute")],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} constructs an ingenious trap, secures food, and feels considerably more capable than before.`,
        effects: [
          acquireNaturalResource("tribute", "food"),
          survived("tribute"),
          applyStatus("tribute", "inspired", 1),
        ],
      }),
    },
  }),

  createItemStatEvent("shield-used-for-everything-else", {
    itemId: "shield",
    check: brains(3),
    tags: ["tool", "item", "status", "resource"],
    periods: ["day", "night"],
    weight: 3.5,
    roleOptions: { getWeight: getVulnerabilityWeight },

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
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} shield as a rain catcher and collects a clean supply of water.`,
        effects: [acquireNaturalResource("tribute", "water"), survived("tribute")],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} shield as a sled and glides into a sheltered hollow containing edible plants and a clean spring.`,
        effects: [
          acquireNaturalResource("tribute", "food"),
          acquireNaturalResource("tribute", "water"),
          survived("tribute"),
        ],
      }),
    },
  }),

  createItemStatEvent("camouflage-catastrophe", {
    itemId: "camouflage-net",
    check: brains(3),
    tags: ["item", "tool", "status"],
    periods: ["day", "night"],
    weight: 3.5,

    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} becomes completely tangled in ${tribute.pronouns.possessiveAdjective} camouflage net and loses all sense of direction.`,
        effects: [applyStatus("tribute", "disoriented", 1)],
      }),

      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} hangs ${tribute.pronouns.possessiveAdjective} camouflage net backwards, creating an extremely visible tribute-shaped landmark.`,
        effects: [applyStatus("tribute", "hunted", 1)],
      }),

      success: result({
        text: ({ tribute }) =>
          `${tribute.name} uses ${tribute.pronouns.possessiveAdjective} camouflage net to disappear into the surrounding terrain.`,
        effects: [applyStatus("tribute", "concealed", 1)],
      }),

      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} constructs an almost perfect hideout with ${tribute.pronouns.possessiveAdjective} camouflage net.`,
        effects: [applyStatus("tribute", "concealed", 2)],
      }),
    },
  }),
] satisfies readonly EventDefinition[];
