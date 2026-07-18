import type { StatusDefinition, StatusEffectId } from "./status-schema";

export const STATUS_CATALOGUE = [
  {
    id: "injured",
    label: "Injured",
    description: "Physical injuries make combat and survival more difficult.",
    maxSeverity: 3,
    defaultDurationRounds: 3,
    penalties: {
      combatPerSeverity: 0.55,
      survivalPerSeverity: 0.3,
      awarenessPerSeverity: 0.1,
      foragingPerSeverity: 0.2,
    },
  },
  {
    id: "bleeding",
    label: "Bleeding",
    description: "An untreated wound steadily weakens the tribute.",
    maxSeverity: 3,
    defaultDurationRounds: 2,
    penalties: {
      combatPerSeverity: 0.45,
      survivalPerSeverity: 0.5,
      awarenessPerSeverity: 0.2,
      foragingPerSeverity: 0.25,
    },
  },
  {
    id: "dehydrated",
    label: "Dehydrated",
    description: "A lack of water reduces concentration and endurance.",
    maxSeverity: 3,
    defaultDurationRounds: 3,
    penalties: {
      combatPerSeverity: 0.25,
      survivalPerSeverity: 0.45,
      awarenessPerSeverity: 0.4,
      foragingPerSeverity: 0.35,
    },
  },
  {
    id: "exposed",
    label: "Exposed",
    description: "The tribute lacks adequate shelter from the elements.",
    maxSeverity: 3,
    defaultDurationRounds: 2,
    penalties: {
      combatPerSeverity: 0.2,
      survivalPerSeverity: 0.5,
      awarenessPerSeverity: 0.25,
      foragingPerSeverity: 0.2,
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
