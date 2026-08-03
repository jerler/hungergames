import type {
  EventSelectionDiagnosticPoolId,
  EventSelectionDiagnosticStage,
  EventSelectionRejectionReason,
} from "./event-selection-diagnostics";

export interface EventSelectionOpportunityContext {
  gameSeed: string;
  roundSequence: number;
  roundPeriod: "day" | "night";
  roundDay: number;
}

export interface EventSelectionOpportunityRecord extends EventSelectionOpportunityContext {
  opportunityId: string;
  opportunityIndex: number;
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  definitionId: string;
  considered: boolean;
  eligible: boolean;
  hardFeasible: boolean;
  /** Transitional alias retained until the report column is migrated. */
  stateFeasible: boolean;
  opportunityFeasible: boolean;
  plannerAdmitted: boolean;
  finalWeightedPool: boolean;
  weightedPoolEntryCount: number;
  uniformExpectedSelections: number;
  drawAttemptCount: number;
  drawn: boolean;
  resolvedAccepted: boolean;
  rejectionReason: EventSelectionRejectionReason | null;
}

export function createEventSelectionOpportunityId({
  gameSeed,
  roundSequence,
  poolId,
  stage,
  opportunityIndex,
}: Pick<
  EventSelectionOpportunityRecord,
  "gameSeed" | "roundSequence" | "poolId" | "stage" | "opportunityIndex"
>): string {
  return [
    gameSeed,
    `round-${roundSequence}`,
    poolId,
    stage,
    `opportunity-${opportunityIndex}`,
  ].join(":");
}
