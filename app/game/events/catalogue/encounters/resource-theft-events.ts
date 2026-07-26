import { createSurvivalNeedTheftEvent } from "~/game/events/authoring";
import type { EventDefinition } from "~/game/events/event-schema";

export const FOOD_THEFT_EVENTS = [
  createSurvivalNeedTheftEvent("steals-fresh-meal", {
    need: "food",
    weight: 1.5,
    texts: {
      criticalFailure: [
        ({ thief, target }) =>
          `${thief.name} lunges for a meal ${target.name} has just finished cooking. ${target.name} reacts instantly and kills ${thief.name} in the struggle.`,
        ({ thief, target }) =>
          `${thief.name} tries to tear freshly cooked food from ${target.name}'s hands, but ${target.name} overpowers and kills ${thief.name}.`,
      ],
      failure: [
        ({ thief, target }) =>
          `${thief.name} rushes ${target.name}'s cooking fire, but the meal is knocked into the dirt. Neither tribute eats, and ${target.name} begins hunting ${thief.name}.`,
        ({ thief, target }) =>
          `${target.name} drives ${thief.name} away before the freshly prepared meal can be stolen. The food is ruined in the fight, and neither tribute is fed.`,
      ],
      success: [
        ({ thief, target }) =>
          `${thief.name} waits until ${target.name} finishes cooking, snatches the meal, and devours it before ${target.name} can react.`,
        ({ thief, target }) =>
          `${thief.name} knocks ${target.name} away from a freshly cooked meal and eats every bite before fleeing.`,
      ],
      exceptionalSuccess: [
        ({ thief, target }) =>
          `${thief.name} distracts ${target.name}, steals the meal straight from the fire, and devours it without leaving a scrap.`,
        ({ thief, target }) =>
          `${thief.name} slips past ${target.name}, seizes the freshly prepared food, and finishes eating before the theft is even noticed.`,
      ],
    },
  }),
] satisfies readonly EventDefinition[];

export const WATER_THEFT_EVENTS = [
  createSurvivalNeedTheftEvent("steals-drink-at-water-source", {
    need: "water",
    weight: 1.5,
    texts: {
      criticalFailure: [
        ({ thief, target }) =>
          `${thief.name} attacks ${target.name} beside a stream, desperate to reach the water. ${target.name} wins the struggle and kills ${thief.name}.`,
        ({ thief, target }) =>
          `${thief.name} lunges past ${target.name} toward a clear spring, but ${target.name} intercepts and kills ${thief.name}.`,
      ],
      failure: [
        ({ thief, target }) =>
          `${thief.name} shoves toward the stream, but ${target.name} drives ${thief.name} away. The struggle churns the water into mud, and neither tribute drinks.`,
        ({ thief, target }) =>
          `${target.name} catches ${thief.name} trying to force a way to the spring. ${thief.name} escapes without drinking, and ${target.name} begins hunting ${thief.name}.`,
      ],
      success: [
        ({ thief, target }) =>
          `${thief.name} shoves ${target.name} away from a stream and drinks a fill before fleeing into the trees.`,
        ({ thief, target }) =>
          `${thief.name} catches ${target.name} off guard beside a spring, reaches the water first, and drinks deeply before escaping.`,
      ],
      exceptionalSuccess: [
        ({ thief, target }) =>
          `${thief.name} lures ${target.name} away from a clear stream, returns unseen, and drinks until fully refreshed.`,
        ({ thief, target }) =>
          `${thief.name} outmaneuvers ${target.name} at the water's edge and drinks a full fill before vanishing into the arena.`,
      ],
    },
  }),
] satisfies readonly EventDefinition[];

export const RESOURCE_THEFT_EVENTS = [
  ...FOOD_THEFT_EVENTS,
  ...WATER_THEFT_EVENTS,
] satisfies readonly EventDefinition[];
