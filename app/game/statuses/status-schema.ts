export type StatusEffectId =
  | "injured"
  | "bleeding"
  | "parched"
  | "dehydrated"
  | "hungry"
  | "starving"
  | "exhausted"
  | "disoriented"
  | "poisoned"
  | "burned"
  | "hidden"
  | "well-fed"
  | "well-rested"
  | "alert"
  | "lucky"
  | "hunted"
  | "inspired";

export type StatusKind = "harmful" | "beneficial";
export type StatusExpiration = "fatal" | "recover";

export type StatusDuration =
  | {
      kind: "timed";
      defaultRounds: number;
      expiration: StatusExpiration;
    }
  | {
      kind: "persistent";
    };

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
  duration: StatusDuration;

  maxSeverity: 3;

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

  duration: {
    kind: "timed";
    defaultRounds: number;
    expiration: "fatal";
  };

  fatalCauseLabel: string;
  fatalSummary: string;

  removalDescription?: never;
}

export interface RecoveringStatusDefinition extends StatusDefinitionBase {
  duration: {
    kind: "timed";
    defaultRounds: number;
    expiration: "recover";
  };

  fatalCauseLabel?: never;
  fatalSummary?: never;
  removalDescription?: never;
}

export interface PersistentStatusDefinition extends StatusDefinitionBase {
  duration: {
    kind: "persistent";
  };

  removalDescription: string;

  fatalCauseLabel?: never;
  fatalSummary?: never;
}

export type StatusDefinition =
  FatalStatusDefinition | RecoveringStatusDefinition | PersistentStatusDefinition;
