import type { StatusDefinition, StatusEffectId } from "./status-schema";

export const STATUS_CATALOGUE = [
  {
    id: "injured",
    label: "Injured",
    description: "Physical injuries make combat and survival more difficult.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Untreated injuries",
    fatalSummary: "succumbs to untreated injuries.",

    maxSeverity: 3,
    defaultDurationRounds: 3,

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
    description: "An untreated wound steadily weakens the tribute.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Bled out",
    fatalSummary: "bleeds out from an untreated wound.",

    maxSeverity: 3,
    defaultDurationRounds: 2,

    modifiers: {
      combatPerSeverity: -0.45,
      survivalPerSeverity: -0.5,
      awarenessPerSeverity: -0.2,
      foragingPerSeverity: -0.25,
    },
  },

  {
    id: "dehydrated",
    label: "Dehydrated",
    description: "A lack of water reduces concentration and endurance.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Dehydration",
    fatalSummary: "succumbs to severe dehydration.",

    maxSeverity: 3,
    defaultDurationRounds: 3,

    modifiers: {
      combatPerSeverity: -0.25,
      survivalPerSeverity: -0.45,
      awarenessPerSeverity: -0.4,
      foragingPerSeverity: -0.35,
    },
  },

  {
    id: "exposed",
    label: "Exposed",
    description: "The tribute lacks adequate shelter from the elements.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Exposure",
    fatalSummary: "succumbs to prolonged exposure.",

    maxSeverity: 3,
    defaultDurationRounds: 2,

    modifiers: {
      combatPerSeverity: -0.2,
      survivalPerSeverity: -0.5,
      awarenessPerSeverity: -0.25,
      foragingPerSeverity: -0.2,
    },
  },

  {
    id: "exhausted",
    label: "Exhausted",
    description: "Fatigue reduces the tribute's strength, concentration, and endurance.",

    kind: "harmful",
    expiration: "recover",

    maxSeverity: 3,
    defaultDurationRounds: 2,

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
    expiration: "recover",

    maxSeverity: 3,
    defaultDurationRounds: 2,

    modifiers: {
      combatPerSeverity: -0.15,
      survivalPerSeverity: -0.2,
      awarenessPerSeverity: -0.6,
      foragingPerSeverity: -0.5,
    },
  },

  {
    id: "sick",
    label: "Sick",
    description: "Illness steadily reduces the tribute's strength and ability to find resources.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Illness",
    fatalSummary: "succumbs to a worsening illness.",

    maxSeverity: 3,
    defaultDurationRounds: 3,

    modifiers: {
      combatPerSeverity: -0.25,
      survivalPerSeverity: -0.45,
      awarenessPerSeverity: -0.25,
      foragingPerSeverity: -0.5,
    },
  },

  {
    id: "poisoned",
    label: "Poisoned",
    description: "Poison rapidly weakens the tribute and requires urgent treatment.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Poisoning",
    fatalSummary: "succumbs to the poison.",

    maxSeverity: 3,
    defaultDurationRounds: 2,

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
    description: "Painful burns make movement, combat, and survival more difficult.",

    kind: "harmful",
    expiration: "fatal",

    fatalCauseLabel: "Severe burns",
    fatalSummary: "succumbs to severe burns.",

    maxSeverity: 3,
    defaultDurationRounds: 3,

    modifiers: {
      combatPerSeverity: -0.5,
      survivalPerSeverity: -0.5,
      awarenessPerSeverity: -0.15,
      foragingPerSeverity: -0.25,
    },
  },

  {
    id: "concealed",
    label: "Concealed",
    description: "Effective camouflage makes the tribute harder to find and safer while moving.",

    kind: "beneficial",
    expiration: "recover",

    maxSeverity: 3,
    defaultDurationRounds: 2,

    modifiers: {
      combatPerSeverity: 0,
      survivalPerSeverity: 0.45,
      awarenessPerSeverity: 0.25,
      foragingPerSeverity: 0.15,
    },
  },

  {
    id: "hunted",
    label: "Hunted",
    description:
      "Another threat is actively tracking the tribute, limiting safe movement and foraging.",

    kind: "harmful",
    expiration: "recover",

    maxSeverity: 3,
    defaultDurationRounds: 2,

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
    expiration: "recover",

    maxSeverity: 3,
    defaultDurationRounds: 2,

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
