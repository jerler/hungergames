import type { EventDefinition, EventResolution } from "~/game/events/event-schema";
import { requireParticipants, requireSingleParticipant } from "~/game/events/event-schema";
import {
  getAwarenessScore,
  getCombatSelectionWeight,
  getDefinitionPopulationMultiplier,
  getForagingScore,
  getSurvivalSelectionWeight,
  getVulnerabilityWeight,
} from "~/game/engine/stat-formulas";
import type { GameChange, GameTribute } from "~/game/types/game-state";

function createFatalChanges(
  victim: GameTribute,
  causeId: string,
  causeLabel: string,
  summary: string,
  killer: GameTribute | null,
): GameChange[] {
  const killerTributeIds = killer ? [killer.id] : [];

  const changes: GameChange[] = [
    {
      type: "eliminate-tribute",
      tributeId: victim.id,
      causeId,
      causeLabel,
      summary,
      killerTributeIds,
    },
  ];

  if (killer) {
    changes.push(
      {
        type: "increment-statistic",
        tributeId: killer.id,
        statistic: "attemptedKills",
        amount: 1,
      },
      {
        type: "increment-statistic",
        tributeId: killer.id,
        statistic: "kills",
        amount: 1,
      },
    );
  }

  return changes;
}

function createSurvivalChanges(participants: readonly GameTribute[]): GameChange[] {
  return participants.map((tribute) => ({
    type: "increment-statistic",
    tributeId: tribute.id,
    statistic: "eventsSurvived",
    amount: 1,
  }));
}

const victimRole = {
  id: "victim",
  count: 1,
  getWeight: getVulnerabilityWeight,
} as const;

const killerRole = {
  id: "killer",
  count: 1,
  getWeight: getCombatSelectionWeight,
} as const;

export const EVENT_CATALOGUE = [
  {
    id: "knife-ambush",
    category: "fatal",
    periods: ["day", "night"],
    baseWeight: 2.5,
    roles: [victimRole, killerRole],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const text =
        `${killer.snapshot.name} catches ` +
        `${victim.snapshot.name} by surprise ` +
        "and kills them with a knife.";

      return {
        text,
        changes: createFatalChanges(victim, "knife-ambush", "Knifed", text, killer),
      };
    },
  },

  {
    id: "spear-attack",
    category: "fatal",
    periods: ["day"],
    baseWeight: 2.25,
    roles: [victimRole, killerRole],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const text =
        `${killer.snapshot.name} strikes ` + `${victim.snapshot.name} down with a spear.`;

      return {
        text,
        changes: createFatalChanges(victim, "spear-attack", "Speared", text, killer),
      };
    },
  },

  {
    id: "fallen-cliff",
    category: "fatal",
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
        changes: createFatalChanges(victim, "fallen-cliff", "Fell", text, null),
      };
    },
  },

  {
    id: "poisonous-berries",
    category: "fatal",
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
        changes: createFatalChanges(victim, "poisonous-berries", "Poisoned", text, null),
      };
    },
  },

  {
    id: "freezing-night",
    category: "fatal",
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
        changes: createFatalChanges(victim, "freezing-night", "Froze", text, null),
      };
    },
  },

  {
    id: "river-current",
    category: "fatal",
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
        changes: createFatalChanges(victim, "river-current", "Drowned", text, null),
      };
    },
  },

  {
    id: "finds-water",
    category: "survival",
    periods: ["day"],
    baseWeight: 9,
    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} discovers ` + "a source of clean water.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },

  {
    id: "finds-hiding-place",
    category: "survival",
    periods: ["day", "night"],
    baseWeight: 8,
    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getSurvivalSelectionWeight,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} finds ` + "a concealed place to rest.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },

  {
    id: "keeps-watch",
    category: "survival",
    periods: ["night"],
    baseWeight: 8,
    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getAwarenessScore,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} stays awake ` + "through the night, listening for danger.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },

  {
    id: "searches-for-supplies",
    category: "survival",
    periods: ["day"],
    baseWeight: 9,
    roles: [
      {
        id: "tribute",
        count: 1,
        getWeight: getForagingScore,
      },
    ],

    resolve({ participantsByRole }): EventResolution {
      const tribute = requireSingleParticipant(participantsByRole, "tribute");

      return {
        text: `${tribute.snapshot.name} spends the day ` + "searching the arena for supplies.",

        changes: createSurvivalChanges([tribute]),
      };
    },
  },

  {
    id: "temporary-truce",
    category: "survival",
    periods: ["day", "night"],
    baseWeight: 7,
    roles: [
      {
        id: "tributes",
        count: 2,
      },
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    getWeightMultiplier: getDefinitionPopulationMultiplier,

    resolve({ participantsByRole }): EventResolution {
      const [firstTribute, secondTribute] = requireParticipants(participantsByRole, "tributes");

      return {
        text:
          `${firstTribute.snapshot.name} and ` +
          `${secondTribute.snapshot.name} agree ` +
          "to a temporary truce.",

        changes: createSurvivalChanges([firstTribute, secondTribute]),
      };
    },
  },
] satisfies readonly EventDefinition[];
