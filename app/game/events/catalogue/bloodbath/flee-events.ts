import {
  acquireNaturalResource,
  applyStatus,
  brains,
  brawn,
  createSoloStatEvent,
  result,
  survived,
} from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const FLEE_EVENTS = [
  createSoloStatEvent("bloodbath-flee-woods", {
    check: brawn(3),
    category: "survival",
    tags: ["environment", "status"],
    periods: ["day"],
    weight: 7,
    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} runs blindly from the Cornucopia, crashes through the undergrowth, and escapes injured and exhausted.`,
        effects: [applyStatus("tribute", "injured", 1), applyStatus("tribute", "exhausted", 1)],
      }),
      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} runs until the sounds of the Bloodbath disappear, then collapses from exhaustion.`,
        effects: [applyStatus("tribute", "exhausted", 1)],
      }),
      success: result({
        text: ({ tribute }) =>
          `${tribute.name} runs directly into the woods and puts a safe distance between ${tribute.pronouns.reflexive} and the Cornucopia.`,
        effects: [survived("tribute")],
      }),
      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} disappears into the woods before the fighting begins and finds a concealed place to watch from safety.`,
        effects: [applyStatus("tribute", "concealed", 1), survived("tribute")],
      }),
    },
  }),

  createSoloStatEvent("bloodbath-flee-stream", {
    check: brains(3),
    category: "survival",
    tags: ["environment", "item", "resource", "status"],
    periods: ["day"],
    weight: 4,
    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} becomes hopelessly lost while searching for water after fleeing the Cornucopia.`,
        effects: [applyStatus("tribute", "disoriented", 2)],
      }),
      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} hears running water but becomes turned around while trying to find it.`,
        effects: [applyStatus("tribute", "disoriented", 1)],
      }),
      success: result({
        text: ({ tribute }) =>
          `${tribute.name} follows the terrain away from the Cornucopia and finds a clean stream.`,
        effects: [acquireNaturalResource("tribute", "water"), survived("tribute")],
      }),
      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} finds a clean stream beside a sheltered hiding place far from the Cornucopia.`,
        effects: [
          acquireNaturalResource("tribute", "water"),
          applyStatus("tribute", "concealed", 1),
          survived("tribute"),
        ],
      }),
    },
  }),

  createSoloStatEvent("bloodbath-flee-forage", {
    check: brains(3),
    category: "survival",
    tags: ["environment", "item", "resource", "status"],
    periods: ["day"],
    weight: 4,
    outcomes: {
      criticalFailure: result({
        text: ({ tribute }) =>
          `${tribute.name} flees into the wilderness and mistakes poisonous berries for edible fruit.`,
        effects: [applyStatus("tribute", "poisoned", 1)],
      }),
      failure: result({
        text: ({ tribute }) =>
          `${tribute.name} eats an unfamiliar root after fleeing and quickly becomes sick.`,
        effects: [applyStatus("tribute", "sick", 1)],
      }),
      success: result({
        text: ({ tribute }) =>
          `${tribute.name} escapes the central Bloodbath and gathers edible plants.`,
        effects: [acquireNaturalResource("tribute", "food"), survived("tribute")],
      }),
      exceptionalSuccess: result({
        text: ({ tribute }) =>
          `${tribute.name} quickly identifies a patch of edible plants and feels confident about ${tribute.pronouns.possessiveAdjective} decision to flee.`,
        effects: [
          acquireNaturalResource("tribute", "food"),
          applyStatus("tribute", "inspired", 1),
          survived("tribute"),
        ],
      }),
    },
  }),
] satisfies readonly EventDefinition[];
