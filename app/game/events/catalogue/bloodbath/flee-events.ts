import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveLuckAdjustedStatCheck } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";

export const FLEE_EVENTS = [
  {
    id: "bloodbath-flee-woods",
    category: "survival",
    tags: ["survival", "environment", "status"],
    periods: ["day"],
    baseWeight: 7,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} runs blindly from ` +
              "the Cornucopia, crashes through the undergrowth, " +
              "and escapes injured and exhausted.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 1, round),

              createStatusChange(eventId, tribute, "exhausted", 1, round),
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} runs until the sounds ` +
              "of the Bloodbath disappear, then collapses " +
              "from exhaustion.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} runs directly into ` +
              "the woods and puts a safe distance between " +
              `${pronouns.reflexive} and the Cornucopia.`,

            changes: createSurvivalChanges([tribute]),
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} disappears into the ` +
              "woods before the fighting begins and finds " +
              "a concealed place to watch from safety.",

            changes: [
              createStatusChange(eventId, tribute, "concealed", 1, round),

              ...createSurvivalChanges([tribute]),
            ],
          };
      }
    },
  },

  {
    id: "bloodbath-flee-stream",
    category: "survival",
    tags: ["survival", "environment", "item", "resource", "status"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} becomes hopelessly ` +
              "lost while searching for water after fleeing " +
              "the Cornucopia.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 2, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} hears running water ` +
              "but becomes turned around while trying to find it.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} follows the terrain ` +
              "away from the Cornucopia and finds a clean stream.",

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              ["water"],
              round,
              "natural-foraging",
            ),
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} finds a clean stream ` +
              "beside a sheltered hiding place far from the " +
              "Cornucopia.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["water"],
                round,
                "natural-foraging",
              ),

              createStatusChange(eventId, tribute, "concealed", 1, round),
            ],
          };
      }
    },
  },

  {
    id: "bloodbath-flee-forage",
    category: "survival",
    tags: ["survival", "environment", "item", "resource", "status"],
    periods: ["day"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,
      },
    ],

    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} flees into the ` +
              "wilderness and mistakes poisonous berries " +
              "for edible fruit.",

            changes: [createStatusChange(eventId, tribute, "poisoned", 1, round)],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} eats an unfamiliar ` +
              "root after fleeing and quickly becomes sick.",

            changes: [createStatusChange(eventId, tribute, "sick", 1, round)],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} escapes the central ` +
              "Bloodbath and gathers edible plants.",

            changes: createItemAcquisitionAndSurvivalChanges(
              eventId,
              tribute,
              ["food"],
              round,
              "natural-foraging",
            ),
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} quickly identifies ` +
              "a patch of edible plants and feels confident " +
              `about ${pronouns.possessiveAdjective} decision to flee.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food"],
                round,
                "natural-foraging",
              ),

              createStatusChange(eventId, tribute, "inspired", 1, round),
            ],
          };
      }
    },
  },
] satisfies readonly EventDefinition[];
