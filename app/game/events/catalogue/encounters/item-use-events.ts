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

export const ITEM_USE_EVENTS = [
  /* Day Only */
  {
    id: "fishing-gear-enormous-fish",
    category: "hazard",
    tags: ["hazard", "tool", "item", "status", "resource"],
    periods: ["day"],
    baseWeight: 3.5,

    roles: [
      {
        id: "tribute",
        count: 1,

        requiredItemDefinitionIds: ["fishing-gear"],

        getWeight: getForagingScore,
      },
    ],

    resolve(context): EventResolution {
      const { eventId, round, random, participantsByRole } = context;
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      const fishingGear = requireEventItem(
        context,
        tribute,
        "fishing-gear",
        "fishing-gear-enormous-fish",
      );

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brawn", 3, random);

      const consumeFishingGear = createItemUseChange(
        fishingGear.owner,
        fishingGear.item,
        "fishing-gear-enormous-fish",
      );

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} hooks an enormous fish and is ` +
              "dragged violently through the water before cutting the line.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 1, round),
              createStatusChange(eventId, tribute, "exhausted", 2, round),
              consumeFishingGear,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} battles an enormous fish for hours, ` +
              "only for it to escape at the last possible moment.",

            changes: [
              createStatusChange(eventId, tribute, "exhausted", 1, round),
              consumeFishingGear,
            ],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} lands an enormous fish ` +
              "and prepares enough food to keep going.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
              consumeFishingGear,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} lands a legendary arena fish ` +
              "and is briefly overwhelmed by their own competence.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
              createStatusChange(eventId, tribute, "inspired", 2, round),
              consumeFishingGear,
            ],
          };
      }
    },
  },
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

      const axe = requireEventItem(context, tribute, "axe", "axe-based-shelter-renovation");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeAxe = createItemUseChange(axe.owner, axe.item, "axe-based-shelter-renovation");

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} attempts an ambitious shelter renovation, ` +
              "drops part of a tree on themself, and destroys the original shelter.",

            changes: [
              createStatusChange(eventId, tribute, "injured", 2, round),
              createStatusChange(eventId, tribute, "exposed", 1, round),
              consumeAxe,
            ],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} demolishes most of their shelter ` +
              "before realizing they had no clear renovation plan.",

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
              "and alerts something in the arena to their location.",

            changes: [createStatusChange(eventId, tribute, "hunted", 1, round), consumeSlingshot],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses a careful slingshot shot ` +
              "to knock edible fruit from a high branch.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
              consumeSlingshot,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} performs an impossible-looking trick shot, ` +
              "collects the fallen food, and feels extremely pleased with themself.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
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
              "without instructions and immediately catches themself.",

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
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
              consumeTrapKit,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} constructs an ingenious trap, ` +
              "secures food, and feels considerably more capable than before.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["food"], round),
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
              `${tribute.snapshot.name} uses their shield as a sled, ` +
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
              `${tribute.snapshot.name} spends hours using their shield ` +
              "as a shovel before becoming firmly stuck in the mud.",

            changes: [createStatusChange(eventId, tribute, "exhausted", 1, round), consumeShield],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses their shield as a rain catcher ` +
              "and collects a clean supply of water.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(eventId, tribute, ["water"], round),
              consumeShield,
            ],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} uses their shield as a sled ` +
              "and accidentally glides directly into a hidden supply cache.",

            changes: [
              ...createItemAcquisitionAndSurvivalChanges(
                eventId,
                tribute,
                ["food", "water"],
                round,
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

      const net = requireEventItem(context, tribute, "camouflage-net", "camouflage-catastrophe");

      const outcome = resolveLuckAdjustedStatCheck(tribute, "brains", 3, random);

      const consumeNet = createItemUseChange(net.owner, net.item, "camouflage-catastrophe");

      switch (outcome) {
        case "critical-failure":
          return {
            text:
              `${tribute.snapshot.name} becomes completely tangled ` +
              "in their camouflage net and loses all sense of direction.",

            changes: [createStatusChange(eventId, tribute, "disoriented", 1, round), consumeNet],
          };

        case "failure":
          return {
            text:
              `${tribute.snapshot.name} hangs their camouflage net backwards, ` +
              "creating an extremely visible tribute-shaped landmark.",

            changes: [createStatusChange(eventId, tribute, "hunted", 1, round), consumeNet],
          };

        case "success":
          return {
            text:
              `${tribute.snapshot.name} uses their camouflage net ` +
              "to disappear into the surrounding terrain.",

            changes: [createStatusChange(eventId, tribute, "concealed", 1, round), consumeNet],
          };

        case "exceptional-success":
          return {
            text:
              `${tribute.snapshot.name} constructs an almost perfect hideout ` +
              "with their camouflage net.",

            changes: [createStatusChange(eventId, tribute, "concealed", 2, round), consumeNet],
          };
      }
    },
  },
] satisfies readonly EventDefinition[];
