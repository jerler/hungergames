export type StatusEffectId =
  | "injured"
  | "bleeding"
  | "dehydrated"
  | "exposed"
  | "exhausted"
  | "disoriented"
  | "sick"
  | "poisoned"
  | "burned"
  | "concealed"
  | "hunted"
  | "inspired";

export type StatusKind = "harmful" | "beneficial";

export type StatusExpiration = "fatal" | "recover";

export interface StatusModifiers {
  combatPerSeverity: number;
  survivalPerSeverity: number;
  awarenessPerSeverity: number;
  foragingPerSeverity: number;
}

interface StatusDefinitionBase {
  id: StatusEffectId;
  label: string;
  description: string;

  kind: StatusKind;
  expiration: StatusExpiration;

  maxSeverity: 3;
  defaultDurationRounds: number;

  /**
   * Signed score adjustments.
   *
   * Negative values reduce a score.
   * Positive values improve a score.
   */
  modifiers: StatusModifiers;
}

export interface FatalStatusDefinition extends StatusDefinitionBase {
  kind: "harmful";
  expiration: "fatal";

  fatalCauseLabel: string;
  fatalSummary: string;
}

export interface RecoveringStatusDefinition extends StatusDefinitionBase {
  expiration: "recover";

  fatalCauseLabel?: never;
  fatalSummary?: never;
}

export type StatusDefinition = FatalStatusDefinition | RecoveringStatusDefinition;
