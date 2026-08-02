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
  stateFeasible: boolean;
  opportunityFeasible: boolean;
  plannerAdmitted: boolean;
  finalWeightedPool: boolean;
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

export function isStateFeasibleCandidate({
  opportunityFeasible,
  rejectionReason,
}: {
  opportunityFeasible: boolean;
  rejectionReason: EventSelectionRejectionReason | null;
}): boolean {
  return opportunityFeasible || rejectionReason === "reservation-blocked";
}
