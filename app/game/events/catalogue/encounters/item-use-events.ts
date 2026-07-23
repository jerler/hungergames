import { getForagingScore, getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import {
  createItemAcquisitionAndSurvivalChanges,
  createItemUseChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireEventItem,
  resolveLuckAdjustedStatCheck,
} from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import {
  acquireNaturalResource,
  applyStatus,
  brawn,
  consumeRequiredItem,
  createEvent,
  hasItem,
  result,
  soloRole,
  statCheck,
  survived,
} from "~/game/events/authoring";

export const ITEM_USE_EVENTS = [
  /* Day Only */
  createEvent("fishing-gear-enormous-fish")
    .roles(soloRole("tribute", { getWeight: getForagingScore }))
    .when(hasItem("tribute", { definitionIds: ["fishing-gear"] }))
    .category("hazard")
    .tags("hazard", "tool", "item", "status", "resource")
    .during("day")
    .weight(3.5)
    .resolve(
      statCheck("tribute", brawn(3), {
        criticalFailure: result({
          text: ({ tribute }) =>
            `${tribute.name} hooks an enormous fish and is dragged violently through the water before cutting the line.`,
          effects: [
            applyStatus("tribute", "injured", 1),
            applyStatus("tribute", "exhausted", 2),
            consumeRequiredItem("tribute", { reason: "fishing-gear-enormous-fish" }),
          ],
        }),
        failure: result({
          text: ({ tribute }) =>
            `${tribute.name} battles an enormous fish for hours, only for it to escape at the last possible moment.`,
          effects: [
            applyStatus("tribute", "exhausted", 1),
            consumeRequiredItem("tribute", { reason: "fishing-gear-enormous-fish" }),
          ],
        }),
        success: result({
          text: ({ tribute }) =>
            `${tribute.name} lands an enormous fish and prepares enough food to keep going.`,
          effects: [
            acquireNaturalResource("tribute", "food"),
            survived("tribute"),
            consumeRequiredItem("tribute", { reason: "fishing-gear-enormous-fish" }),
          ],
        }),
        exceptionalSuccess: result({
          text: ({ tribute }) =>
            `${tribute.name} lands a legendary arena fish and is briefly overwhelmed by ${tribute.pronouns.possessiveAdjective} own competence.`,
          effects: [
            acquireNaturalResource("tribute", "food"),
            survived("tribute"),
            applyStatus("tribute", "inspired", 2),
            consumeRequiredItem("tribute", { reason: "fishing-gear-enormous-fish" }),
          ],
        }),
      }),
    ),
  {
    id: "axe-based-shelter-renovation",
    category: "hazard",
    tags: ["hazard", "environment", "weapon", "tool", "item", "status"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["axe"],
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);
      const axe = requireEventItem(context, tribute, "axe", "axe-based-shelter-renovation");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeAxe = createItemUseChange(axe.owner, axe.item, "axe-based-shelter-renovation");

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} attempts an ambitious shelter renovation, ` +
              `drops part of a tree on ${pronouns.reflexive}, ` +
              "and destroys the original shelter.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 2, round),
              createStatusChange(eventId, tribute, "exposed", 1, round),
              consumeAxe,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} demolishes most of ` +
              `${pronouns.possessiveAdjective} shelter before realizing ` +
              `${pronouns.subject} had no clear renovation plan.`,

            changes: [
              createStatusChange(eventId, tribute, "exhausted", 1, round),
              createStatusChange(eventId, tribute, "exposed", 1, round),
              consumeAxe,
            ],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses an axe to construct ` +
              "a sturdy shelter hidden among the trees.",

            changes: [
              createStatusChange(eventId, tribute, "concealed", 1, round),
              ...createSurvivalChanges([tribute]),
              consumeAxe,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} transforms a rough shelter ` +
              "into an exceptionally concealed arena hideout.",

            changes: [
              createStatusChange(eventId, tribute, "concealed", 2, round),
              createStatusChange(eventId, tribute, "inspired", 1, round),
              ...createSurvivalChanges([tribute]),
              consumeAxe,
            ],
          };
      }
    },
  },
  {
    id: "slingshot-trick-shot",
    category: "hazard",
    tags: ["hazard", "weapon", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["slingshot"],
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);

      const slingshot = requireEventItem(context, tribute, "slingshot", "slingshot-trick-shot");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeSlingshot = createItemUseChange(
        slingshot.owner,
        slingshot.item,
        "slingshot-trick-shot",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} attempts an elaborate ricochet shot ` +
              "and discovers exactly where the stone eventually returns.",

            changes: [createStatusChange(eventId, tribute, "injured", 1, round), consumeSlingshot],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} misses a trick shot completely ` +
              `and alerts something in the arena to ` +
              `${pronouns.possessiveAdjective} location.`,

            changes: [createStatusChange(eventId, tribute, "hunted", 1, round), consumeSlingshot],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses a careful slingshot shot ` +
              "to knock edible fruit from a high branch.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food"],
                round,
                "natural-foraging",
              ),
              consumeSlingshot,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} performs an impossible-looking trick shot, ` +
              "collects the fallen food, and feels extremely pleased with " +
              `${pronouns.reflexive}.`,

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food"],
                round,
                "natural-foraging",
              ),
              createStatusChange(eventId, tribute, "inspired", 1, round),
              consumeSlingshot,
            ],
          };
      }
    },
  },

  /* Night Only */

  /* Day and Night */
  {
    id: "trap-kit-instructions-missing",
    category: "hazard",
    tags: ["hazard", "tool", "item", "status", "resource"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["trap-kit"],

        getWeight: getForagingScore,
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);

      const trapKit = requireEventItem(
        context,
        tribute,
        "trap-kit",
        "trap-kit-instructions-missing",
      );

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeTrapKit = createItemUseChange(
        trapKit.owner,
        trapKit.item,
        "trap-kit-instructions-missing",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} tries to assemble a trap kit ` +
              `without instructions and immediately catches ` +
              `${pronouns.reflexive}.`,

            changes: [createStatusChange(eventId, tribute, "injured", 1, round), consumeTrapKit],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} spends hours constructing a trap ` +
              "that repeatedly springs before anything approaches it.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round), consumeTrapKit],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} successfully assembles a trap ` +
              "and catches enough game for a meal.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food"],
                round,
                "natural-foraging",
              ),
              consumeTrapKit,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} constructs an ingenious trap, ` +
              "secures food, and feels considerably more capable than before.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food"],
                round,
                "natural-foraging",
              ),
              createStatusChange(eventId, tribute, "inspired", 1, round),
              consumeTrapKit,
            ],
          };
      }
    },
  },
  {
    id: "shield-used-for-everything-else",
    category: "hazard",
    tags: ["hazard", "tool", "item", "status", "resource"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["shield"],

        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);

      const shield = requireEventItem(
        context,
        tribute,
        "shield",
        "shield-used-for-everything-else",
      );

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeShield = createItemUseChange(
        shield.owner,
        shield.item,
        "shield-used-for-everything-else",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} uses ${pronouns.possessiveAdjective} shield as a sled, ` +
              "discovers an unexpected ravine, and loses all sense of direction.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 1, round),
              createStatusChange(eventId, tribute, "disoriented", 1, round),
              consumeShield,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} spends hours using ${pronouns.possessiveAdjective} shield ` +
              "as a shovel before becoming firmly stuck in the mud.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round), consumeShield],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses ${pronouns.possessiveAdjective} shield as a rain catcher ` +
              "and collects a clean supply of water.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["water"],
                round,
                "natural-foraging",
              ),
              consumeShield,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} uses ${pronouns.possessiveAdjective} shield as a sled ` +
              "and glides into a sheltered hollow containing edible " +
              "plants and a clean spring.",
            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food", "water"],
                round,
                "natural-foraging",
              ),
              consumeShield,
            ],
          };
      }
    },
  },
  {
    id: "camouflage-catastrophe",
    category: "hazard",
    tags: ["hazard", "item", "tool", "status"],
    periods: ["day", "night"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["camouflage-net"],
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;
      const tribute = requireSingleParticipant(participantsByRole, "tribute");
      const pronouns = getTributePronouns(tribute);

      const net = requireEventItem(context, tribute, "camouflage-net", "camouflage-catastrophe");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeNet = createItemUseChange(net.owner, net.item, "camouflage-catastrophe");

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} becomes completely tangled ` +
              `in ${pronouns.possessiveAdjective} camouflage net and loses all sense of direction.`,

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round), consumeNet],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} hangs ${pronouns.possessiveAdjective} camouflage net backwards, ` +
              "creating an extremely visible tribute-shaped landmark.",

            changes: [createStatusChange(eventId, tribute, "hunted", 1, round), consumeNet],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses ${pronouns.possessiveAdjective} camouflage net ` +
              "to disappear into the surrounding terrain.",

            changes: [createStatusChange(eventId, tribute, "concealed", 1, round), consumeNet],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} constructs an almost perfect hideout ` +
              `with ${pronouns.possessiveAdjective} camouflage net.`,

            changes: [createStatusChange(eventId, tribute, "concealed", 2, round), consumeNet],
          };
      }
    },
  },
] satisfies readonly EventDefinition[];
