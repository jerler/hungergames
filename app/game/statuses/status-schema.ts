export type StatusEffectId = "injured" | "bleeding" | "dehydrated" | "exposed";

export interface StatusPenalties {
  combatPerSeverity: number;
  survivalPerSeverity: number;
  awarenessPerSeverity: number;
  foragingPerSeverity: number;
}

export interface StatusDefinition {
  id: StatusEffectId;
  label: string;
  description: string;

  fatalCauseLabel: string;
  fatalSummary: string;

  maxSeverity: 3;
  defaultDurationRounds: number;

  penalties: StatusPenalties;
}
