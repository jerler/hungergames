import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameChange, GameTribute } from "~/game/types/game-state";

function createFatalArenaChanges(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
): GameChange[] {
  return [
    {
      type: "eliminate-tribute",
      tributeId: victim.id,
      causeId,
      causeLabel,
      summary,
      killerTributeIds: [],
    },
  ];
}

const victimRole = {
  id: "victim",
  count: 1,
  getWeight: getVulnerabilityWeight,
} as const;

export const ARENA_HAZARD_EVENTS = [
  {
    id: "fallen-cliff",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["day", "night"],
    baseWeight: 2,

    roles: [
      {
        ...victimRole,

        getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.luck),
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text =
        `${victim.snapshot.name} loses their footing ` + "near a cliff and falls to their death.";

      return {
        text,

        changes: createFatalArenaChanges(victim, "fallen-cliff", "Fell", text),
      };
    },
  },

  {
    id: "poisonous-berries",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["day"],
    baseWeight: 2,

    roles: [
      {
        id: "victim",
        count: 1,

        isEligible: (tribute) => tribute.snapshot.stats.brains <= 4,

        getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brains),
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text = `${victim.snapshot.name} mistakes ` + "poisonous berries for food.";

      return {
        text,

        changes: createFatalArenaChanges(victim, "poisonous-berries", "Poisoned", text),
      };
    },
  },

  {
    id: "freezing-night",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["night"],
    baseWeight: 2.25,

    roles: [
      {
        ...victimRole,

        isEligible: (tribute) => tribute.snapshot.stats.brawn <= 4,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text =
        `${victim.snapshot.name} is unable to find ` + "shelter and freezes during the night.";

      return {
        text,

        changes: createFatalArenaChanges(victim, "freezing-night", "Froze", text),
      };
    },
  },

  {
    id: "river-current",
    category: "fatal",
    tags: ["fatal", "hazard"],
    periods: ["day"],
    baseWeight: 2,

    roles: [
      {
        id: "victim",
        count: 1,

        isEligible: (tribute) => tribute.snapshot.stats.brawn <= 4,

        getWeight: (tribute) => Math.max(0.25, 6 - tribute.snapshot.stats.brawn),
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const text = `${victim.snapshot.name} is swept away ` + "while crossing a violent river.";

      return {
        text,

        changes: createFatalArenaChanges(victim, "river-current", "Drowned", text),
      };
    },
  },

  {
    id: "rough-terrain",
    category: "hazard",
    tags: ["hazard", "status", "environment"],
    periods: ["day"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} is injured while ` + "crossing rough terrain.",

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "injured", 1, round),
          },
        ],
      };
    },
  },

  {
    id: "deep-cut",
    category: "hazard",
    tags: ["hazard", "status"],
    periods: ["day", "night"],
    baseWeight: 4,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} suffers ` + "a deep cut and begins bleeding.",

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "bleeding", 2, round),
          },
        ],
      };
    },
  },

  {
    id: "contaminated-water",
    category: "hazard",
    tags: ["hazard", "status", "environment"],
    periods: ["day"],
    baseWeight: 5,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} drinks contaminated ` + "water and becomes dehydrated.",

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "dehydrated", 2, round),
          },
        ],
      };
    },
  },

  {
    id: "cold-rain",
    category: "hazard",
    tags: ["hazard", "status", "environment"],
    periods: ["night"],
    baseWeight: 6,

    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getVulnerabilityWeight,
      },
    ],

    resolve({ eventId, round, participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} is caught without ` + "shelter in freezing rain.",

        changes: [
          {
            type: "apply-status",
            tributeId: tribute.id,

            status: createStatusEffectInstance(eventId, tribute.id, "exposed", 2, round),
          },
        ],
      };
    },
  },
] satisfies readonly EventDefinition[];
