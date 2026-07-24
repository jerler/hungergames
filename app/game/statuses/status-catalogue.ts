import type { StatusDefinition, StatusEffectId } from "./status-schema";

export const STATUS_CATALOGUE = [
  {
    id: "injured",
    label: "Injured",
    description:
      "Physical injuries make combat, movement, and survival more difficult while the tribute recovers.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 3,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.55,
      survivalPerSeverity: -0.3,
      awarenessPerSeverity: -0.1,
      foragingPerSeverity: -0.2,
    },
  },

  {
    id: "bleeding",
    label: "Bleeding",
    description:
      "An untreated wound steadily weakens the tribute and will eventually become fatal.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "fatal",
    },

    fatalCauseLabel: "Bled out",
    fatalSummary: "bleeds out from an untreated wound.",

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.45,
      survivalPerSeverity: -0.5,
      awarenessPerSeverity: -0.2,
      foragingPerSeverity: -0.25,
    },
  },

  {
    id: "parched",
    label: "Parched",
    description:
      "Thirst reduces the tribute's concentration, endurance, and ability to gather resources.",

    kind: "harmful",

    duration: {
      kind: "persistent",
    },

    removalDescription: "Remains until the tribute drinks enough water to recover.",

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.1,
      survivalPerSeverity: -0.25,
      awarenessPerSeverity: -0.2,
      foragingPerSeverity: -0.2,
    },
  },

  {
    id: "dehydrated",
    label: "Dehydrated",
    description:
      "Severe dehydration rapidly reduces concentration and endurance and will become fatal if untreated.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 3,
      expiration: "fatal",
    },

    fatalCauseLabel: "Dehydration",
    fatalSummary: "succumbs to severe dehydration.",

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.25,
      survivalPerSeverity: -0.45,
      awarenessPerSeverity: -0.4,
      foragingPerSeverity: -0.35,
    },
  },

  {
    id: "hungry",
    label: "Hungry",
    description:
      "Hunger reduces the tribute's strength, patience, and ability to gather resources.",

    kind: "harmful",

    duration: {
      kind: "persistent",
    },

    removalDescription: "Remains until the tribute eats enough food to recover.",

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.1,
      survivalPerSeverity: -0.2,
      awarenessPerSeverity: -0.1,
      foragingPerSeverity: -0.25,
    },
  },

  {
    id: "starving",
    label: "Starving",
    description:
      "Prolonged hunger severely weakens the tribute and will become fatal without food.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 3,
      expiration: "fatal",
    },

    fatalCauseLabel: "Starvation",
    fatalSummary: "succumbs to starvation.",

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.45,
      survivalPerSeverity: -0.65,
      awarenessPerSeverity: -0.3,
      foragingPerSeverity: -0.55,
    },
  },

  {
    id: "exhausted",
    label: "Exhausted",
    description:
      "Fatigue reduces the tribute's strength, concentration, and endurance until they recover.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.35,
      survivalPerSeverity: -0.3,
      awarenessPerSeverity: -0.35,
      foragingPerSeverity: -0.2,
    },
  },

  {
    id: "disoriented",
    label: "Disoriented",
    description: "The tribute is confused, lost, and less able to notice useful details.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.15,
      survivalPerSeverity: -0.2,
      awarenessPerSeverity: -0.6,
      foragingPerSeverity: -0.5,
    },
  },

  {
    id: "poisoned",
    label: "Poisoned",
    description: "Poison rapidly weakens the tribute and will become fatal without treatment.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "fatal",
    },

    fatalCauseLabel: "Poisoning",
    fatalSummary: "succumbs to the poison.",

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.35,
      survivalPerSeverity: -0.65,
      awarenessPerSeverity: -0.35,
      foragingPerSeverity: -0.3,
    },
  },

  {
    id: "burned",
    label: "Burned",
    description:
      "Painful burns make movement, combat, and survival more difficult while they heal.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 3,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.5,
      survivalPerSeverity: -0.5,
      awarenessPerSeverity: -0.15,
      foragingPerSeverity: -0.25,
    },
  },

  {
    id: "hidden",
    label: "Hidden",
    description:
      "Effective concealment makes the tribute more difficult for hostile opponents to find and target.",

    kind: "beneficial",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: 0,
      survivalPerSeverity: 0.45,
      awarenessPerSeverity: 0.25,
      foragingPerSeverity: 0.15,
    },
  },

  {
    id: "well-fed",
    label: "Well Fed",
    description:
      "A satisfying meal temporarily improves the tribute's energy, endurance, and resourcefulness.",

    kind: "beneficial",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: 0.15,
      survivalPerSeverity: 0.3,
      awarenessPerSeverity: 0.1,
      foragingPerSeverity: 0.2,
    },
  },

  {
    id: "well-rested",
    label: "Well Rested",
    description:
      "Safe, restorative sleep temporarily improves the tribute's energy and concentration.",

    kind: "beneficial",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: 0.15,
      survivalPerSeverity: 0.2,
      awarenessPerSeverity: 0.3,
      foragingPerSeverity: 0.15,
    },
  },

  {
    id: "alert",
    label: "Alert",
    description:
      "Heightened attention temporarily improves the tribute's awareness of threats and opportunities.",

    kind: "beneficial",

    duration: {
      kind: "timed",
      defaultRounds: 1,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: 0.1,
      survivalPerSeverity: 0.1,
      awarenessPerSeverity: 0.5,
      foragingPerSeverity: 0.15,
    },
  },

  {
    id: "lucky",
    label: "Lucky",
    description:
      "A temporary run of good fortune improves the tribute's effective Luck without changing their permanent stats.",

    kind: "beneficial",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    /*
     * Lucky is handled by getEffectiveLuck rather
     * than the ordinary score-modifier system.
     */
    modifiers: {
      combatPerSeverity: 0,
      survivalPerSeverity: 0,
      awarenessPerSeverity: 0,
      foragingPerSeverity: 0,
    },
  },

  {
    id: "hunted",
    label: "Hunted",
    description:
      "Another threat is actively tracking the tribute, limiting safe movement and foraging.",

    kind: "harmful",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: -0.1,
      survivalPerSeverity: -0.45,
      awarenessPerSeverity: -0.2,
      foragingPerSeverity: -0.35,
    },
  },

  {
    id: "inspired",
    label: "Inspired",
    description:
      "Renewed determination temporarily improves the tribute's confidence and performance.",

    kind: "beneficial",

    duration: {
      kind: "timed",
      defaultRounds: 2,
      expiration: "recover",
    },

    maxSeverity: 3,

    modifiers: {
      combatPerSeverity: 0.25,
      survivalPerSeverity: 0.25,
      awarenessPerSeverity: 0.2,
      foragingPerSeverity: 0.15,
    },
  },
] satisfies readonly StatusDefinition[];

export function getStatusDefinition(statusId: StatusEffectId): StatusDefinition {
  const definition = STATUS_CATALOGUE.find((candidate) => candidate.id === statusId);

  if (!definition) {
    throw new Error(`Unknown status definition "${statusId}".`);
  }

  return definition;
}
