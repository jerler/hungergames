import {
  countPlannedEliminations,
  determineBloodbathFatalityTarget,
  getRemainingBloodbathFatalityTarget,
} from "~/game/bloodbath/bloodbath-balance";
import {
  canCompleteBloodbathFatalityTargetAfterProfile,
  getBloodbathFatalProfileWeight,
  type BloodbathFatalSelectionProfile,
  getMaximumReachablePostTargetReservation,
  getBestEffortBloodbathFatalProfiles,
} from "~/game/bloodbath/bloodbath-fatal-planner";
import {
  getBloodbathFatalityTargetForPostTargetReservation,
  canCoverBloodbathPostTargetParticipantsAfterDefinition,
  getBloodbathPostTargetDefinitionWeight,
} from "~/game/bloodbath/bloodbath-post-target-planner";
import {
  canCoverBloodbathFleeParticipantsAfterDefinition,
  getBloodbathFleeDefinitionWeight,
} from "~/game/bloodbath/bloodbath-flee-planner";
import { assignBloodbathStrategies } from "~/game/bloodbath/bloodbath-strategy";
import {
  createSeededRandom,
  selectWeightedItem,
  shuffleItems,
  type RandomSource,
} from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import {
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_FATAL_DELAYED_EVENTS,
  CORNUCOPIA_FATAL_TARGET_PROFILES,
  CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  CORNUCOPIA_GROUP_CONFLICT_EVENTS,
  CORNUCOPIA_NONFATAL_PAIR_EVENTS,
  CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
  CORNUCOPIA_NONFATAL_TRIO_EVENTS,
  CORNUCOPIA_PAIR_CONFLICT_EVENTS,
  FLEE_EVENTS,
  STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
} from "~/game/events/catalogue/bloodbath";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import type {
  EventFeedGroup,
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import { createInventoryItemInstance } from "~/game/items/inventory-engine";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { CORNUCOPIA_PROVISIONS_ITEM_ID } from "~/game/items/deprivation-protection";
import { validateEventResolution } from "~/game/events/validation/validate-event-resolution";
import { selectEventParticipants } from "~/game/events/participant-selection";
import {
  isEventSelectionDiagnosticsActive,
  recordEventSelectionCandidateEvaluation,
  recordEventSelectionOpportunity,
  type EventSelectionDiagnosticPoolId,
  type EventSelectionDiagnosticStage,
  type EventSelectionRejectionReason,
} from "~/game/simulation/event-selection-diagnostics";
import {
  hasUsableCornucopiaContestedDirectWeapon,
  hasUsableCornucopiaPackItem,
  selectCornucopiaContestedDirectWeapon,
  selectCornucopiaPackItem,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";

function createEventId(round: RoundReference, eventIndex: number, definitionId: string): string {
  return ["bloodbath", round.period, round.day, eventIndex, definitionId].join("-");
}

function countResolvedEventEliminations(events: readonly ResolvedEvent[]): number {
  return events.reduce((total, event) => total + countPlannedEliminations(event.changes), 0);
}

function hasNeedSatisfaction(
  event: ResolvedEvent,
  tributeId: string,
  need: "food" | "water",
): boolean {
  return event.changes.some(
    (change) =>
      change.type === "satisfy-survival-need" &&
      change.tributeId === tributeId &&
      change.need === need,
  );
}

export function addCornucopiaProvisions(
  event: ResolvedEvent,
  tributes: readonly GameTribute[],
  eligibleTributeIds: readonly string[] = event.participantTributeIds,
): ResolvedEvent {
  const eliminatedTributeIds = new Set(
    event.changes.flatMap((change) =>
      change.type === "eliminate-tribute" ? [change.tributeId] : [],
    ),
  );

  const tributeById = new Map(tributes.map((tribute) => [tribute.id, tribute] as const));

  const survivors = [...new Set(eligibleTributeIds)]
    .filter((tributeId) => !eliminatedTributeIds.has(tributeId))
    .map((tributeId) => {
      const tribute = tributeById.get(tributeId);

      if (!tribute) {
        throw new Error(
          `Cornucopia event "${event.id}" references ` + `missing survivor "${tributeId}".`,
        );
      }

      return tribute;
    });

  if (survivors.length === 0) {
    return event;
  }

  const additionalChanges: ResolvedEvent["changes"][number][] = [];

  for (const tribute of survivors) {
    const alreadyReceivesProvisions = event.changes.some(
      (change) =>
        change.type === "acquire-item" &&
        change.tributeId === tribute.id &&
        change.item.definitionId === CORNUCOPIA_PROVISIONS_ITEM_ID,
    );

    if (!alreadyReceivesProvisions) {
      additionalChanges.push({
        type: "acquire-item",
        tributeId: tribute.id,
        acquisitionSource: "cornucopia",
        item: createInventoryItemInstance(
          event.id,
          tribute.id,
          CORNUCOPIA_PROVISIONS_ITEM_ID,
          event.round,
        ),
      });
    }

    if (!hasNeedSatisfaction(event, tribute.id, "food")) {
      additionalChanges.push({
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need: "food",
      });
    }

    if (!hasNeedSatisfaction(event, tribute.id, "water")) {
      additionalChanges.push({
        type: "satisfy-survival-need",
        tributeId: tribute.id,
        need: "water",
      });
    }
  }

  return {
    ...event,
    changes: [...event.changes, ...additionalChanges],
  };
}

interface ResolveBloodbathEventOptions {
  state: GameState;
  round: RoundReference;
  livingTributes: readonly GameTribute[];
  definition: EventDefinition;
  participantsByRole: ParticipantsByRole;
  eventIndex: number;
  feedGroup: EventFeedGroup;
  random: RandomSource;
  unavailableItemInstanceIds: Set<string>;
}

function resolveBloodbathEvent({
  state,
  round,
  livingTributes,
  definition,
  participantsByRole,
  eventIndex,
  feedGroup,
  random,
  unavailableItemInstanceIds,
}: ResolveBloodbathEventOptions): ResolvedEvent {
  const eventId = createEventId(round, eventIndex, definition.id);

  const resolution = definition.resolve({
    state,
    round,
    livingTributes,

    eventId,
    random,
    participantsByRole,

    unavailableItemInstanceIds,
  });

  validateEventResolution({
    eventId,
    definitionId: definition.id,
    round,
    resolution,
  });

  const committedItemInstanceIds = getCommittedItemInstanceIds(resolution.changes);

  for (const itemInstanceId of committedItemInstanceIds) {
    if (unavailableItemInstanceIds.has(itemInstanceId)) {
      throw new Error(`Bloodbath item "${itemInstanceId}" ` + "was committed more than once.");
    }

    unavailableItemInstanceIds.add(itemInstanceId);
  }

  return {
    id: eventId,
    definitionId: definition.id,
    kind: "primary",
    resolutionMode: "standard",
    feedGroup,
    round,
    participantTributeIds: Object.values(participantsByRole)
      .flat()
      .map((tribute) => tribute.id),
    text: resolution.text,
    changes: resolution.changes,
  };
}

export interface BloodbathAcquisitionSelection {
  definition: EventDefinition;

  participantsByRole: ParticipantsByRole;
}

interface CornucopiaSequenceResult {
  events: ResolvedEvent[];
  nextEventIndex: number;
  plannedEliminationCount: number;
}

function getDefinitionParticipantCount(definition: EventDefinition): number {
  return definition.roles.reduce((total, role) => total + role.count, 0);
}

/*
 * Reserve enough of the fatality target for a later pair-only pass to make
 * survivor reuse meaningful, while guaranteeing enough first-pass survivors
 * remain even if the ordinary planner overshoots its soft target by one.
 */
function getRequestedSupplementalFatalityCount(
  cornucopiaTributeCount: number,
  fatalityTarget: number,
): number {
  /*
   * One extra pair fatality is enough to materially change Half Game shape.
   * Full Games receive two. Keeping this deliberately small limits repeated
   * protagonists and keeps the 500-game balance samples inexpensive.
   */
  const desiredCount = cornucopiaTributeCount >= 14 ? 2 : 1;
  const survivorSafeCount = Math.max(0, cornucopiaTributeCount - fatalityTarget - 1);

  return Math.min(desiredCount, fatalityTarget, survivorSafeCount);
}

/*
 * These definitions are authored through either createPairFatalEvent without
 * selected items/additional changes, or an equivalent direct definition.
 * Their resolutions contain one elimination plus kill/survival statistics.
 *
 * Keeping this list explicit avoids repeatedly resolving item-, status-, and
 * truce-bearing definitions merely to reject them during large simulations.
 * isSafeSupplementalFatalEvent remains the runtime assertion protecting this
 * catalogue contract.
 */
const SAFE_SUPPLEMENTAL_FATAL_DEFINITION_IDS = new Set([
  "cornucopia-fatal-thrown-knife-head",
  "cornucopia-fatal-thrown-knife-chest",
  "cornucopia-fatal-fistfight-strangulation",
  "cornucopia-fatal-head-against-rock",
  "cornucopia-fatal-silent-neck-break",
  "cornucopia-fatal-cherry-bomb-attack",
  "cornucopia-fatal-killed-while-fleeing",
  "cornucopia-fatal-improvised-branch-stabbing",
  "cornucopia-fatal-discovering-hidden-tribute",
]);

function isSafeSupplementalFatalEvent(event: ResolvedEvent): boolean {
  const eliminationCount = countPlannedEliminations(event.changes);

  return (
    eliminationCount === 1 &&
    event.participantTributeIds.length === 2 &&
    new Set(event.participantTributeIds).size === 2 &&
    event.changes.every(
      (change) => change.type === "eliminate-tribute" || change.type === "increment-statistic",
    )
  );
}

interface BloodbathDiagnosticFeasibility {
  hardFeasibleDefinitions: EventDefinition[];
  opportunityFeasibleDefinitions: EventDefinition[];
}

function collectBloodbathDiagnosticFeasibility({
  state,
  round,
  remainingTributes,
  definitions,
  poolId,
  stage,
  diagnosticKey,
  getOpportunityRejectionReason,
}: {
  state: GameState;
  round: RoundReference;
  remainingTributes: readonly GameTribute[];
  definitions: readonly EventDefinition[];
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  diagnosticKey: string;
  getOpportunityRejectionReason?: (
    definition: EventDefinition,
  ) => EventSelectionRejectionReason | null;
}): BloodbathDiagnosticFeasibility {
  if (!isEventSelectionDiagnosticsActive()) {
    return {
      hardFeasibleDefinitions: [],
      opportunityFeasibleDefinitions: [],
    };
  }

  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };
  const uniqueDefinitions = [
    ...new Map(definitions.map((definition) => [definition.id, definition])).values(),
  ];
  const hardFeasibleDefinitions: EventDefinition[] = [];
  const opportunityFeasibleDefinitions: EventDefinition[] = [];

  for (const definition of uniqueDefinitions) {
    if (!isEventDefinitionEligible(definition, context)) {
      recordEventSelectionCandidateEvaluation({
        poolId,
        stage,
        definition,
        eligible: false,
        hardFeasible: false,
        opportunityFeasible: false,
        rejectionReason: "definition-ineligible",
      });
      continue;
    }

    if (getDefinitionParticipantCount(definition) > remainingTributes.length) {
      recordEventSelectionCandidateEvaluation({
        poolId,
        stage,
        definition,
        eligible: true,
        hardFeasible: false,
        opportunityFeasible: false,
        rejectionReason: "participant-count-unavailable",
      });
      continue;
    }

    const diagnosticSelection = selectEventParticipants(
      definition,
      context,
      createSeededRandom(
        [
          state.seed,
          round.day,
          round.period,
          "selection-diagnostics",
          diagnosticKey,
          definition.id,
        ].join(":"),
      ),
      new Set<string>(),
      new Set<string>(),
    );

    if (!diagnosticSelection) {
      recordEventSelectionCandidateEvaluation({
        poolId,
        stage,
        definition,
        eligible: true,
        hardFeasible: false,
        opportunityFeasible: false,
        rejectionReason: "participant-or-item-infeasible",
      });
      continue;
    }

    hardFeasibleDefinitions.push(definition);

    const opportunityRejectionReason = getOpportunityRejectionReason?.(definition) ?? null;
    const opportunityFeasible = opportunityRejectionReason === null;

    recordEventSelectionCandidateEvaluation({
      poolId,
      stage,
      definition,
      eligible: true,
      hardFeasible: true,
      opportunityFeasible,
      ...(opportunityRejectionReason
        ? {
            rejectionReason: opportunityRejectionReason,
          }
        : {}),
    });

    if (opportunityFeasible) {
      opportunityFeasibleDefinitions.push(definition);
    }
  }

  return {
    hardFeasibleDefinitions,
    opportunityFeasibleDefinitions,
  };
}

function removeSelectedBloodbathParticipants(
  remainingTributes: GameTribute[],
  participantTributeIds: readonly string[],
  definitionId: string,
): void {
  for (const tributeId of participantTributeIds) {
    const tributeIndex = remainingTributes.findIndex((tribute) => tribute.id === tributeId);

    if (tributeIndex < 0) {
      throw new Error(
        `Bloodbath event "${definitionId}" selected unavailable tribute "${tributeId}".`,
      );
    }

    remainingTributes.splice(tributeIndex, 1);
  }
}

export function getBloodbathFatalSelectionProfiles(): BloodbathFatalSelectionProfile[] {
  const rawProfiles: BloodbathFatalSelectionProfile[] = [
    ...CORNUCOPIA_FATAL_TARGET_PROFILES,
    ...CORNUCOPIA_PAIR_CONFLICT_EVENTS.map((definition) => ({
      definition,
      minImmediateEliminations: 0,
      maxImmediateEliminations: 1,
    })),
    ...CORNUCOPIA_GROUP_CONFLICT_EVENTS.map((definition) => ({
      definition,
      minImmediateEliminations: 0,
      maxImmediateEliminations: 3,
    })),
    ...CORNUCOPIA_FATAL_DELAYED_EVENTS.map((definition) => ({
      definition,
      minImmediateEliminations: 0,
      maxImmediateEliminations: 0,
      selectionWeightMultiplier: 0.08,
    })),
  ];

  return [...new Map(rawProfiles.map((profile) => [profile.definition.id, profile])).values()];
}

export function selectAuthoredFatalBloodbathEvent(
  state: GameState,
  round: RoundReference,
  remainingTributes: GameTribute[],
  fatalityDeficit: number,
  reservedPostTargetCount: number,
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
  providedFatalSelectionProfiles: readonly BloodbathFatalSelectionProfile[] = getBloodbathFatalSelectionProfiles(),
): BloodbathAcquisitionSelection | null {
  /*
   * Phase 3: unified Cornucopia fatal candidate pool.
   *
   * Every hard-feasible fatal definition competes in one weighted draw.
   * Participant shape changes effective weight, but no shape receives a
   * separate planner branch or structural priority.
   */
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };

  /*
   * The production catalogue remains the default. Tests may inject a tiny
   * controlled profile set so planner behaviour can be proved without copying
   * the selector or depending on unrelated authored events.
   */
  const fatalSelectionProfiles = [
    ...new Map(
      providedFatalSelectionProfiles.map((profile) => [profile.definition.id, profile]),
    ).values(),
  ];

  const availableFatalParticipants = Math.max(
    0,
    remainingTributes.length - reservedPostTargetCount,
  );
  const fatalSurvivorBudget = Math.max(0, availableFatalParticipants - fatalityDeficit);

  const getHardRejectionReason = (
    profile: BloodbathFatalSelectionProfile,
  ): EventSelectionRejectionReason | null => {
    const participantCount = getDefinitionParticipantCount(profile.definition);
    const worstCaseSurvivorCost = participantCount - profile.minImmediateEliminations;

    if (usedDefinitionIds.has(profile.definition.id)) {
      return "already-used-definition";
    }

    if (participantCount > remainingTributes.length) {
      return "participant-count-unavailable";
    }

    if (participantCount > availableFatalParticipants) {
      return "reservation-blocked";
    }

    if (profile.maxImmediateEliminations > fatalityDeficit + 1) {
      return "fatality-target-overshoot";
    }

    if (worstCaseSurvivorCost > fatalSurvivorBudget) {
      return "fatality-survivor-budget";
    }

    return null;
  };

  const hardFeasibleProfiles = fatalSelectionProfiles.filter(
    (profile) =>
      getHardRejectionReason(profile) === null &&
      isEventDefinitionEligible(profile.definition, context),
  );

  const candidateProfiles = hardFeasibleProfiles.filter((profile) =>
    canCompleteBloodbathFatalityTargetAfterProfile({
      profile,
      remainingProfiles: hardFeasibleProfiles.filter(
        (candidate) => candidate.definition.id !== profile.definition.id,
      ),
      availableParticipantCount: availableFatalParticipants,
      fatalityDeficit,
    }),
  );
  const relaxedFeasibleProfiles = fatalSelectionProfiles.filter((profile) => {
    const participantCount = getDefinitionParticipantCount(profile.definition);

    return (
      !usedDefinitionIds.has(profile.definition.id) &&
      participantCount <= availableFatalParticipants &&
      profile.maxImmediateEliminations <= fatalityDeficit + 1 &&
      profile.maxImmediateEliminations > 0 &&
      isEventDefinitionEligible(profile.definition, context)
    );
  });
  const bestEffortProfiles =
    candidateProfiles.length === 0 && reservedPostTargetCount === 0
      ? (() => {
          const guaranteedProgressProfiles = relaxedFeasibleProfiles.filter(
            (profile) => profile.minImmediateEliminations > 0,
          );

          return guaranteedProgressProfiles.length > 0
            ? guaranteedProgressProfiles
            : relaxedFeasibleProfiles;
        })()
      : [];

  const candidateDefinitionIds = new Set(candidateProfiles.map((profile) => profile.definition.id));

  const plannerEligibleDefinitionIds = new Set([
    ...candidateDefinitionIds,
    ...bestEffortProfiles.map((profile) => profile.definition.id),
  ]);

  const diagnosticFeasibility = collectBloodbathDiagnosticFeasibility({
    state,
    round,
    remainingTributes,
    definitions: fatalSelectionProfiles.map((profile) => profile.definition),
    poolId: "bloodbath-cornucopia",
    stage: "cornucopia-fatal",
    diagnosticKey: [
      "fatal-unified",
      remainingTributes.length,
      fatalityDeficit,
      reservedPostTargetCount,
    ].join(":"),
    getOpportunityRejectionReason: (definition) => {
      const profile = fatalSelectionProfiles.find(
        (candidate) => candidate.definition.id === definition.id,
      );

      if (!profile) {
        return "participant-or-item-infeasible";
      }

      return getDefinitionParticipantCount(profile.definition) > availableFatalParticipants
        ? "reservation-blocked"
        : null;
    },
  });

  const plannerConsideredDefinitionIds = new Set(plannerEligibleDefinitionIds);
  const opportunityRejectionReasons = new Map<string, EventSelectionRejectionReason>();

  for (const definition of diagnosticFeasibility.hardFeasibleDefinitions) {
    const profile = fatalSelectionProfiles.find(
      (candidate) => candidate.definition.id === definition.id,
    );

    if (!profile) {
      continue;
    }

    const hardRejectionReason = getHardRejectionReason(profile);

    if (hardRejectionReason === "already-used-definition") {
      opportunityRejectionReasons.set(definition.id, "repeat-cycle-excluded");
    } else if (hardRejectionReason && hardRejectionReason !== "reservation-blocked") {
      opportunityRejectionReasons.set(definition.id, hardRejectionReason);
    } else if (hardRejectionReason === null && !plannerEligibleDefinitionIds.has(definition.id)) {
      opportunityRejectionReasons.set(definition.id, "fatality-target-stranded");
    }
  }

  const weightedPoolDefinitionIdsByDraw: Set<string>[] = [];
  const drawnDefinitionIds: string[] = [];

  const finishSelection = (
    selection: BloodbathAcquisitionSelection | null,
  ): BloodbathAcquisitionSelection | null => {
    recordEventSelectionOpportunity({
      poolId: "bloodbath-cornucopia",
      stage: "cornucopia-fatal",
      feasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
      hardFeasibleDefinitions: diagnosticFeasibility.hardFeasibleDefinitions,
      opportunityFeasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
      selectedDefinition: selection?.definition ?? null,
      plannerConsideredDefinitionIds,
      weightedPoolDefinitionIdsByDraw,
      drawnDefinitionIds,
      rejectionReasonsByDefinitionId: opportunityRejectionReasons,
    });

    return selection;
  };

  const usingBestEffortProfiles = candidateProfiles.length === 0;
  let remainingProfiles = usingBestEffortProfiles
    ? [...bestEffortProfiles]
    : [...candidateProfiles];

  while (remainingProfiles.length > 0) {
    const selectableProfiles = usingBestEffortProfiles
      ? getBestEffortBloodbathFatalProfiles(remainingProfiles)
      : remainingProfiles;

    weightedPoolDefinitionIdsByDraw.push(
      new Set(selectableProfiles.map((candidate) => candidate.definition.id)),
    );

    const profile = selectWeightedItem(
      selectableProfiles,
      (candidate) => getBloodbathFatalProfileWeight(candidate, context),
      random,
    );
    drawnDefinitionIds.push(profile.definition.id);
    const selection = selectEventParticipants(
      profile.definition,
      context,
      random,
      new Set<string>(),
    );

    if (!selection) {
      opportunityRejectionReasons.set(profile.definition.id, "post-draw-resolution-rejected");
      remainingProfiles = remainingProfiles.filter(
        (candidate) => candidate.definition.id !== profile.definition.id,
      );

      if (!usingBestEffortProfiles) {
        remainingProfiles = remainingProfiles.filter((candidate) =>
          canCompleteBloodbathFatalityTargetAfterProfile({
            profile: candidate,
            remainingProfiles: remainingProfiles.filter(
              (other) => other.definition.id !== candidate.definition.id,
            ),
            availableParticipantCount: availableFatalParticipants,
            fatalityDeficit,
          }),
        );
      }

      continue;
    }

    removeSelectedBloodbathParticipants(
      remainingTributes,
      selection.participantTributeIds,
      profile.definition.id,
    );

    return finishSelection({
      definition: profile.definition,
      participantsByRole: selection.participantsByRole,
    });
  }

  return finishSelection(null);
}

function selectSupplementalFatalBloodbathEvent(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  availableTributes: readonly GameTribute[],
  fatalityDeficit: number,
  eventIndex: number,
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
  unavailableItemInstanceIds: ReadonlySet<string>,
): ResolvedEvent | null {
  /*
   * This pass deliberately stays inside the existing static round model.
   *
   * A repeated event is accepted only after it has been fully resolved and
   * proven to contain exactly one death plus statistic changes. It may not
   * acquire, use, consume, loot, or transfer items; alter statuses or needs;
   * or form/break relationships. Consequently it has no dependency on state
   * produced by the tribute's first event and replays identically later.
   */
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: availableTributes,
  };
  const supplementalProfiles = getBloodbathFatalSelectionProfiles().filter(
    (profile) =>
      profile.minImmediateEliminations === 1 &&
      profile.maxImmediateEliminations === 1 &&
      getDefinitionParticipantCount(profile.definition) === 2 &&
      SAFE_SUPPLEMENTAL_FATAL_DEFINITION_IDS.has(profile.definition.id),
  );
  const candidateProfiles = supplementalProfiles.filter(
    (profile) =>
      !usedDefinitionIds.has(profile.definition.id) &&
      isEventDefinitionEligible(profile.definition, context),
  );
  const diagnosticFeasibility = collectBloodbathDiagnosticFeasibility({
    state,
    round,
    remainingTributes: availableTributes,
    definitions: supplementalProfiles.map((profile) => profile.definition),
    poolId: "bloodbath-cornucopia",
    stage: "cornucopia-repeat-fatal",
    diagnosticKey: ["repeat-fatal", availableTributes.length, fatalityDeficit].join(":"),
  });
  const plannerConsideredDefinitionIds = new Set(
    candidateProfiles.map((profile) => profile.definition.id),
  );
  const rejectionReasonsByDefinitionId = new Map<string, EventSelectionRejectionReason>();

  for (const definition of diagnosticFeasibility.opportunityFeasibleDefinitions) {
    if (usedDefinitionIds.has(definition.id)) {
      rejectionReasonsByDefinitionId.set(definition.id, "repeat-cycle-excluded");
    }
  }

  const weightedPoolDefinitionIdsByDraw: Set<string>[] = [];
  const drawnDefinitionIds: string[] = [];

  const finishSelection = (
    event: ResolvedEvent | null,
    definition: EventDefinition | null,
  ): ResolvedEvent | null => {
    recordEventSelectionOpportunity({
      poolId: "bloodbath-cornucopia",
      stage: "cornucopia-repeat-fatal",
      feasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
      hardFeasibleDefinitions: diagnosticFeasibility.hardFeasibleDefinitions,
      opportunityFeasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
      selectedDefinition: definition,
      plannerConsideredDefinitionIds,
      weightedPoolDefinitionIdsByDraw,
      drawnDefinitionIds,
      rejectionReasonsByDefinitionId,
    });

    return event;
  };

  let remainingProfiles = [...candidateProfiles];

  while (remainingProfiles.length > 0) {
    weightedPoolDefinitionIdsByDraw.push(
      new Set(remainingProfiles.map((candidate) => candidate.definition.id)),
    );

    const profile = selectWeightedItem(
      remainingProfiles,
      (candidate) => getBloodbathFatalProfileWeight(candidate, context),
      random,
    );
    drawnDefinitionIds.push(profile.definition.id);
    const selection = selectEventParticipants(
      profile.definition,
      context,
      random,
      new Set<string>(),
      new Set<string>(),
    );

    if (!selection) {
      rejectionReasonsByDefinitionId.set(profile.definition.id, "post-draw-resolution-rejected");
      remainingProfiles = remainingProfiles.filter(
        (candidate) => candidate.definition.id !== profile.definition.id,
      );
      continue;
    }

    /*
     * Candidate resolution receives a private reservation snapshot. Rejected
     * item-bearing outcomes therefore cannot reserve anything in the real
     * Bloodbath plan.
     */
    const candidateEvent = resolveBloodbathEvent({
      state,
      round,
      livingTributes,
      definition: profile.definition,
      participantsByRole: selection.participantsByRole,
      eventIndex,
      feedGroup: "bloodbath-cornucopia",
      random,
      unavailableItemInstanceIds: new Set(unavailableItemInstanceIds),
    });

    if (!isSafeSupplementalFatalEvent(candidateEvent)) {
      rejectionReasonsByDefinitionId.set(profile.definition.id, "post-draw-resolution-rejected");
      remainingProfiles = remainingProfiles.filter(
        (candidate) => candidate.definition.id !== profile.definition.id,
      );
      continue;
    }

    return finishSelection(candidateEvent, profile.definition);
  }

  return finishSelection(null, null);
}

const RARE_CORNUCOPIA_BONUS_ITEM_CHANCE = 0.1;

export function normalizeCornucopiaAcquisitions(
  event: ResolvedEvent,
  tributes: readonly GameTribute[],
  random: RandomSource,
  definition: EventDefinition,
): ResolvedEvent {
  if (definition.cornucopiaAcquisitionPolicy?.preserveAuthoredItems) {
    return event;
  }

  const acquisitionTributeIds = [
    ...new Set(
      event.changes.flatMap((change) =>
        change.type === "acquire-item" && change.item.definitionId !== CORNUCOPIA_PROVISIONS_ITEM_ID
          ? [change.tributeId]
          : [],
      ),
    ),
  ];

  if (acquisitionTributeIds.length === 0) {
    return event;
  }

  let normalizedChanges = [...event.changes];

  for (const tributeId of acquisitionTributeIds) {
    const tribute = tributes.find((candidate) => candidate.id === tributeId);

    if (!tribute) {
      throw new Error(
        `Cornucopia event "${event.id}" awarded an item to missing tribute "${tributeId}".`,
      );
    }

    const tributeAcquisitions = normalizedChanges.filter(
      (change) =>
        change.type === "acquire-item" &&
        change.tributeId === tributeId &&
        change.item.definitionId !== CORNUCOPIA_PROVISIONS_ITEM_ID,
    );

    const offensiveAcquisitions = tributeAcquisitions.filter(
      (change) =>
        change.type === "acquire-item" &&
        Boolean(getItemDefinition(change.item.definitionId).offense),
    );

    const supplyAcquisitions = tributeAcquisitions.filter(
      (change) =>
        change.type === "acquire-item" && !getItemDefinition(change.item.definitionId).offense,
    );

    /*
     * Remove every non-offensive acquisition first.
     * At most one may be restored as the rare
     * secondary item after a weapon is guaranteed.
     */
    const supplyItemInstanceIds = new Set(
      supplyAcquisitions.flatMap((change) =>
        change.type === "acquire-item" ? [change.item.id] : [],
      ),
    );

    normalizedChanges = normalizedChanges.filter(
      (change) => change.type !== "acquire-item" || !supplyItemInstanceIds.has(change.item.id),
    );

    if (offensiveAcquisitions.length === 0) {
      if (!hasUsableCornucopiaContestedDirectWeapon(tribute)) {
        throw new Error(
          `Cornucopia event "${event.id}" could not award tribute "${tributeId}" a usable weapon.`,
        );
      }

      const weaponItemId = selectCornucopiaContestedDirectWeapon(tribute, random);

      normalizedChanges.push({
        type: "acquire-item",
        tributeId,
        acquisitionSource: "cornucopia",
        item: createInventoryItemInstance(event.id, tributeId, weaponItemId, event.round),
      });
    }

    if (random() >= RARE_CORNUCOPIA_BONUS_ITEM_CHANCE) {
      continue;
    }

    const existingSupply = supplyAcquisitions.find((change) => change.type === "acquire-item");

    if (existingSupply?.type === "acquire-item") {
      normalizedChanges.push(existingSupply);
      continue;
    }

    if (!hasUsableCornucopiaPackItem(tribute)) {
      continue;
    }

    const bonusItemId = selectCornucopiaPackItem(tribute, random);

    normalizedChanges.push({
      type: "acquire-item",
      tributeId,
      acquisitionSource: "cornucopia",
      item: createInventoryItemInstance(event.id, tributeId, bonusItemId, event.round),
    });
  }

  return {
    ...event,
    changes: normalizedChanges,
  };
}

export function getBloodbathPostTargetDefinitions(): EventDefinition[] {
  const weaponAcquisitionDefinitions = [
    ...CORNUCOPIA_ACQUISITION_EVENTS,
    ...CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  ].filter((definition) => (definition.tags as readonly string[]).includes("weapon"));

  return [
    ...new Map(
      [
        ...CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
        ...CORNUCOPIA_NONFATAL_TRIO_EVENTS,
        ...CORNUCOPIA_NONFATAL_PAIR_EVENTS,
        ...weaponAcquisitionDefinitions,
        ...STAT_GATED_CORNUCOPIA_FLAVOUR_EVENTS,
      ].map((definition) => [definition.id, definition]),
    ).values(),
  ];
}

export function selectPostTargetCornucopiaEvent(
  state: GameState,
  round: RoundReference,
  remainingTributes: GameTribute[],
  usedDefinitionIds: ReadonlySet<string>,
  selectedEventCount: number,
  selectedSoloEventCount: number,
  random: RandomSource,
  providedDefinitions: readonly EventDefinition[] = getBloodbathPostTargetDefinitions(),
): BloodbathAcquisitionSelection {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };
  const uniquePostTargetDefinitions = [
    ...new Map(providedDefinitions.map((definition) => [definition.id, definition])).values(),
  ];
  const hardFeasibleDefinitions = uniquePostTargetDefinitions.filter(
    (definition) =>
      !usedDefinitionIds.has(definition.id) &&
      getDefinitionParticipantCount(definition) <= remainingTributes.length &&
      isEventDefinitionEligible(definition, context),
  );
  const opportunityRejectionReasons = new Map<string, EventSelectionRejectionReason>();
  const feasibleSelections = hardFeasibleDefinitions.flatMap((definition) => {
    const selection = selectEventParticipants(
      definition,
      context,
      createSeededRandom(
        [
          state.seed,
          round.day,
          round.period,
          "cornucopia-post-target-candidate",
          remainingTributes
            .map((tribute) => tribute.id)
            .sort()
            .join(","),
          definition.id,
        ].join(":"),
      ),
      new Set<string>(),
      new Set<string>(),
    );

    if (!selection) {
      opportunityRejectionReasons.set(definition.id, "participant-or-item-infeasible");
      return [];
    }

    return [
      {
        definition,
        participantsByRole: selection.participantsByRole,
        participantTributeIds: selection.participantTributeIds,
      },
    ];
  });
  const coverageSafeSelections = feasibleSelections.filter((selection) =>
    canCoverBloodbathPostTargetParticipantsAfterDefinition({
      definition: selection.definition,
      remainingDefinitions: feasibleSelections
        .filter((candidate) => candidate.definition.id !== selection.definition.id)
        .map((candidate) => candidate.definition),
      availableParticipantCount: remainingTributes.length,
    }),
  );
  const coverageSafeDefinitionIds = new Set(
    coverageSafeSelections.map((selection) => selection.definition.id),
  );

  for (const selection of feasibleSelections) {
    if (!coverageSafeDefinitionIds.has(selection.definition.id)) {
      opportunityRejectionReasons.set(selection.definition.id, "exact-cover-excluded");
    }
  }

  const diagnosticFeasibility = collectBloodbathDiagnosticFeasibility({
    state,
    round,
    remainingTributes,
    definitions: uniquePostTargetDefinitions,
    poolId: "bloodbath-cornucopia",
    stage: "cornucopia-post-target",
    diagnosticKey: ["post-target-unified", remainingTributes.length].join(":"),
  });

  for (const definition of diagnosticFeasibility.opportunityFeasibleDefinitions) {
    if (usedDefinitionIds.has(definition.id)) {
      opportunityRejectionReasons.set(definition.id, "repeat-cycle-excluded");
    }
  }

  const plannerConsideredDefinitionIds = new Set(
    coverageSafeSelections.map((selection) => selection.definition.id),
  );
  const weightedPoolDefinitionIdsByDraw =
    coverageSafeSelections.length > 0
      ? [new Set(coverageSafeSelections.map((selection) => selection.definition.id))]
      : [];
  const drawnDefinitionIds: string[] = [];
  const finishSelection = (
    selection: BloodbathAcquisitionSelection | null,
  ): BloodbathAcquisitionSelection | null => {
    recordEventSelectionOpportunity({
      poolId: "bloodbath-cornucopia",
      stage: "cornucopia-post-target",
      feasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
      hardFeasibleDefinitions: diagnosticFeasibility.hardFeasibleDefinitions,
      opportunityFeasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
      selectedDefinition: selection?.definition ?? null,
      plannerConsideredDefinitionIds,
      weightedPoolDefinitionIdsByDraw,
      drawnDefinitionIds,
      rejectionReasonsByDefinitionId: opportunityRejectionReasons,
    });

    return selection;
  };

  if (coverageSafeSelections.length === 0) {
    finishSelection(null);

    throw new Error(
      `No unused nonfatal Bloodbath event could exactly cover ${remainingTributes.length} remaining Cornucopia tribute(s).`,
    );
  }

  const hasNonSoloCandidate = coverageSafeSelections.some(
    (selection) => getDefinitionParticipantCount(selection.definition) > 1,
  );
  const selected = selectWeightedItem(
    coverageSafeSelections,
    (selection) =>
      getBloodbathPostTargetDefinitionWeight(selection.definition, context, {
        selectedEventCount,
        selectedSoloEventCount,
        hasNonSoloCandidate,
      }),
    random,
  );

  drawnDefinitionIds.push(selected.definition.id);

  removeSelectedBloodbathParticipants(
    remainingTributes,
    selected.participantTributeIds,
    selected.definition.id,
  );

  return finishSelection({
    definition: selected.definition,
    participantsByRole: selected.participantsByRole,
  }) as BloodbathAcquisitionSelection;
}

function sequenceCornucopiaEvents(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  cornucopiaTributes: readonly GameTribute[],
  fatalityTarget: number,
  startingEventIndex: number,
  random: RandomSource,
  unavailableItemInstanceIds: Set<string>,
): CornucopiaSequenceResult {
  const remainingTributes = shuffleItems(cornucopiaTributes, random);

  const events: ResolvedEvent[] = [];
  const usedDefinitionIds = new Set<string>();

  let eventIndex = startingEventIndex;

  let plannedEliminationCount = 0;
  let postTargetEventCount = 0;
  let postTargetSoloEventCount = 0;

  /*
   * The ordinary unique-participant pass intentionally leaves a small,
   * survivor-safe portion of the target for pair fatalities after every
   * Cornucopia entrant has received a first event.
   */
  const requestedSupplementalFatalityCount = getRequestedSupplementalFatalityCount(
    cornucopiaTributes.length,
    fatalityTarget,
  );
  const softFatalityTarget = Math.max(0, fatalityTarget - requestedSupplementalFatalityCount);

  /*
   * Reserve a seeded one-to-four-person group for acquisition and
   * nonfatal Cornucopia events. Fatal planning may release entrants
   * one at a time when real role or item feasibility requires it.
   */
  const maximumRequestedPostTargetReservation = Math.min(
    4,
    Math.max(1, remainingTributes.length - 1),
  );
  const requestedPostTargetCount = selectWeightedItem(
    Array.from(
      {
        length: maximumRequestedPostTargetReservation,
      },
      (_, index) => index + 1,
    ),
    (count) => {
      switch (count) {
        case 1:
          return 3;
        case 2:
          return 5;
        case 3:
          return 1.5;
        case 4:
          return 0.75;
        default:
          return 0;
      }
    },
    random,
  );
  const protectedPostTargetFatalityTarget = getBloodbathFatalityTargetForPostTargetReservation({
    fatalityTarget: softFatalityTarget,
    startingTributeCount: livingTributes.length,
    requestedPostTargetCount,
  });
  const fatalPlanningContext: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };
  const eligibleFatalSelectionProfiles = getBloodbathFatalSelectionProfiles().filter((profile) =>
    isEventDefinitionEligible(profile.definition, fatalPlanningContext),
  );
  let reservedPostTargetCount = getMaximumReachablePostTargetReservation({
    profiles: eligibleFatalSelectionProfiles,
    totalParticipantCount: remainingTributes.length,
    fatalityDeficit: protectedPostTargetFatalityTarget,
    requestedReservation: requestedPostTargetCount,
  });

  while (remainingTributes.length > 0) {
    const activeFatalityTarget =
      reservedPostTargetCount >= 3 ? protectedPostTargetFatalityTarget : softFatalityTarget;
    const fatalityDeficit = activeFatalityTarget - plannedEliminationCount;

    let definition: EventDefinition;

    let participantsByRole: ParticipantsByRole;

    /*
     * Prefer the larger authored fatal catalogue while retaining
     * the original pair and group conflicts as balance fallbacks.
     *
     * Role selection happens before participants are removed, so
     * persistent rewards always go to a tribute who can use them.
     */
    /*
     * Keep selecting immediate-fatal events only while the current
     * soft goal still has a deficit and the reserved post-target group
     * remains untouched.
     *
     * A null selection means the remaining participant mix cannot
     * pursue the goal safely. In that case the target is allowed to
     * undershoot and the rest of the entrants receive acquisition or
     * non-fatal interaction events.
     */
    let fatalSelection: BloodbathAcquisitionSelection | null = null;

    if (fatalityDeficit > 0) {
      while (remainingTributes.length > 0) {
        if (remainingTributes.length <= reservedPostTargetCount) {
          if (reservedPostTargetCount === 0) {
            break;
          }

          reservedPostTargetCount -= 1;
          continue;
        }

        fatalSelection = selectAuthoredFatalBloodbathEvent(
          state,
          round,
          remainingTributes,
          fatalityDeficit,
          reservedPostTargetCount,
          usedDefinitionIds,
          random,
        );

        if (fatalSelection || reservedPostTargetCount === 0) {
          break;
        }

        /*
         * Real role or item feasibility removed the abstract completion
         * route. Release one reserved entrant and retry the fatal phase.
         */
        reservedPostTargetCount -= 1;
      }
    }

    if (fatalSelection) {
      definition = fatalSelection.definition;
      participantsByRole = fatalSelection.participantsByRole;
    } else {
      const postTargetSelection = selectPostTargetCornucopiaEvent(
        state,
        round,
        remainingTributes,
        usedDefinitionIds,
        postTargetEventCount,
        postTargetSoloEventCount,
        random,
      );

      definition = postTargetSelection.definition;
      participantsByRole = postTargetSelection.participantsByRole;
      postTargetEventCount += 1;

      if (getDefinitionParticipantCount(definition) === 1) {
        postTargetSoloEventCount += 1;
      }
    }

    const resolvedEvent = resolveBloodbathEvent({
      state,
      round,
      livingTributes,
      definition,
      participantsByRole,
      eventIndex,
      feedGroup: "bloodbath-cornucopia",
      random,
      unavailableItemInstanceIds,
    });

    const bonusRandom = createSeededRandom(
      [state.seed, resolvedEvent.id, "cornucopia-bonus-item"].join(":"),
    );

    const eventWithPossibleBonus = normalizeCornucopiaAcquisitions(
      resolvedEvent,
      livingTributes,
      bonusRandom,
      definition,
    );
    /*
     * Every survivor selected through the fatal Cornucopia planner must
     * receive provisions through their first appearance. The planner
     * designation is authoritative: some authored fatal profiles use a
     * non-fatal category or variable immediate outcomes.
     *
     * Role-scoped provisioning remains useful for post-target nonfatal
     * scenes where only a specific participant reaches the supplies.
     */
    const provisionRoleIds = fatalSelection
      ? undefined
      : definition.cornucopiaAcquisitionPolicy?.provisionRoleIds;
    const provisionTributeIds = provisionRoleIds
      ? provisionRoleIds.flatMap((roleId) =>
          (participantsByRole[roleId] ?? []).map((tribute) => tribute.id),
        )
      : eventWithPossibleBonus.participantTributeIds;

    const event = addCornucopiaProvisions(
      eventWithPossibleBonus,
      livingTributes,
      provisionTributeIds,
    );

    plannedEliminationCount += countPlannedEliminations(event.changes);

    if (usedDefinitionIds.has(definition.id)) {
      throw new Error(`Bloodbath event definition "${definition.id}" was selected more than once.`);
    }

    usedDefinitionIds.add(definition.id);
    events.push(event);

    eventIndex += 1;
  }

  /*
   * Every entrant has now received one ordinary Cornucopia event. Survivors
   * who did not form a truce may receive one additional, stateless pair
   * fatality. Both participants are removed from this repeat pool afterward,
   * enforcing the hard two-appearance cap without changing round replay.
   */
  const firstPassEliminatedTributeIds = new Set(
    events.flatMap((event) =>
      event.changes.flatMap((change) =>
        change.type === "eliminate-tribute" ? [change.tributeId] : [],
      ),
    ),
  );
  const firstPassTruceTributeIds = new Set(
    events.flatMap((event) =>
      event.changes.flatMap((change) =>
        change.type === "form-truce" ? [...change.truce.tributeIds] : [],
      ),
    ),
  );
  const firstPassProvisionedTributeIds = new Set(
    events.flatMap((event) =>
      event.changes.flatMap((change) =>
        change.type === "acquire-item" && change.item.definitionId === CORNUCOPIA_PROVISIONS_ITEM_ID
          ? [change.tributeId]
          : [],
      ),
    ),
  );
  const repeatEligibleTributes = shuffleItems(
    cornucopiaTributes.filter(
      (tribute) =>
        !firstPassEliminatedTributeIds.has(tribute.id) &&
        !firstPassTruceTributeIds.has(tribute.id) &&
        firstPassProvisionedTributeIds.has(tribute.id),
    ),
    random,
  );

  while (plannedEliminationCount < fatalityTarget && repeatEligibleTributes.length >= 2) {
    const supplementalEvent = selectSupplementalFatalBloodbathEvent(
      state,
      round,
      livingTributes,
      repeatEligibleTributes,
      fatalityTarget - plannedEliminationCount,
      eventIndex,
      usedDefinitionIds,
      random,
      unavailableItemInstanceIds,
    );

    if (!supplementalEvent) {
      break;
    }

    removeSelectedBloodbathParticipants(
      repeatEligibleTributes,
      supplementalEvent.participantTributeIds,
      supplementalEvent.definitionId,
    );

    if (usedDefinitionIds.has(supplementalEvent.definitionId)) {
      throw new Error(
        `Bloodbath event definition "${supplementalEvent.definitionId}" was selected more than once.`,
      );
    }

    usedDefinitionIds.add(supplementalEvent.definitionId);
    events.push(supplementalEvent);
    plannedEliminationCount += countPlannedEliminations(supplementalEvent.changes);
    eventIndex += 1;
  }

  return {
    events,
    nextEventIndex: eventIndex,
    plannedEliminationCount,
  };
}

export function selectFleeBloodbathEvent(
  state: GameState,
  round: RoundReference,
  remainingTributes: GameTribute[],
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
  recordDiagnostics: boolean,
  providedDefinitions: readonly EventDefinition[] = FLEE_EVENTS,
): BloodbathAcquisitionSelection | null {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };
  const uniqueDefinitions = [
    ...new Map(providedDefinitions.map((definition) => [definition.id, definition])).values(),
  ];
  const hardFeasibleDefinitions = uniqueDefinitions.filter(
    (definition) =>
      !usedDefinitionIds.has(definition.id) &&
      getDefinitionParticipantCount(definition) <= remainingTributes.length &&
      isEventDefinitionEligible(definition, context),
  );
  const rejectionReasonsByDefinitionId = new Map<string, EventSelectionRejectionReason>();
  const feasibleSelections = hardFeasibleDefinitions.flatMap((definition) => {
    const selection = selectEventParticipants(
      definition,
      context,
      createSeededRandom(
        [
          state.seed,
          round.day,
          round.period,
          "flee-candidate",
          remainingTributes
            .map((tribute) => tribute.id)
            .sort()
            .join(","),
          definition.id,
        ].join(":"),
      ),
      new Set<string>(),
      new Set<string>(),
    );

    if (!selection) {
      rejectionReasonsByDefinitionId.set(definition.id, "participant-or-item-infeasible");
      return [];
    }

    return [
      {
        definition,
        participantsByRole: selection.participantsByRole,
        participantTributeIds: selection.participantTributeIds,
      },
    ];
  });
  const coverageSafeSelections = feasibleSelections.filter((selection) =>
    canCoverBloodbathFleeParticipantsAfterDefinition({
      definition: selection.definition,
      remainingDefinitions: feasibleSelections
        .filter((candidate) => candidate.definition.id !== selection.definition.id)
        .map((candidate) => candidate.definition),
      availableParticipantCount: remainingTributes.length,
    }),
  );
  const coverageSafeDefinitionIds = new Set(
    coverageSafeSelections.map((selection) => selection.definition.id),
  );

  for (const selection of feasibleSelections) {
    if (!coverageSafeDefinitionIds.has(selection.definition.id)) {
      rejectionReasonsByDefinitionId.set(selection.definition.id, "exact-cover-excluded");
    }
  }

  const diagnosticFeasibility = recordDiagnostics
    ? collectBloodbathDiagnosticFeasibility({
        state,
        round,
        remainingTributes,
        definitions: uniqueDefinitions,
        poolId: "bloodbath-flee",
        stage: "flee",
        diagnosticKey: ["flee-unified", remainingTributes.length].join(":"),
      })
    : {
        hardFeasibleDefinitions: [],
        opportunityFeasibleDefinitions: [],
      };

  for (const definition of diagnosticFeasibility.opportunityFeasibleDefinitions) {
    if (usedDefinitionIds.has(definition.id)) {
      rejectionReasonsByDefinitionId.set(definition.id, "repeat-cycle-excluded");
    }
  }

  const plannerConsideredDefinitionIds = new Set(
    coverageSafeSelections.map((selection) => selection.definition.id),
  );
  const weightedPoolDefinitionIdsByDraw =
    coverageSafeSelections.length > 0
      ? [new Set(coverageSafeSelections.map((selection) => selection.definition.id))]
      : [];
  const drawnDefinitionIds: string[] = [];
  const finishSelection = (
    selection: BloodbathAcquisitionSelection | null,
  ): BloodbathAcquisitionSelection | null => {
    if (recordDiagnostics) {
      recordEventSelectionOpportunity({
        poolId: "bloodbath-flee",
        stage: "flee",
        feasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
        hardFeasibleDefinitions: diagnosticFeasibility.hardFeasibleDefinitions,
        opportunityFeasibleDefinitions: diagnosticFeasibility.opportunityFeasibleDefinitions,
        selectedDefinition: selection?.definition ?? null,
        plannerConsideredDefinitionIds,
        weightedPoolDefinitionIdsByDraw,
        drawnDefinitionIds,
        rejectionReasonsByDefinitionId,
      });
    }

    return selection;
  };

  if (coverageSafeSelections.length === 0) {
    return finishSelection(null);
  }

  const selected = selectWeightedItem(
    coverageSafeSelections,
    (selection) => getBloodbathFleeDefinitionWeight(selection.definition, context),
    random,
  );

  drawnDefinitionIds.push(selected.definition.id);

  removeSelectedBloodbathParticipants(
    remainingTributes,
    selected.participantTributeIds,
    selected.definition.id,
  );

  return finishSelection({
    definition: selected.definition,
    participantsByRole: selected.participantsByRole,
  });
}

function sequenceFleeEvents(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  fleeingTributes: readonly GameTribute[],
  startingEventIndex: number,
  random: RandomSource,
  unavailableItemInstanceIds: Set<string>,
  recordDiagnostics = true,
): ResolvedEvent[] {
  const remainingTributes = shuffleItems(fleeingTributes, random);
  const events: ResolvedEvent[] = [];
  const usedDefinitionIds = new Set<string>();
  let eventIndex = startingEventIndex;

  while (remainingTributes.length > 0) {
    /*
     * Every hard-feasible fleeing definition competes in one weighted
     * pool. Exact-cover look-ahead prevents the selected participant
     * shape from stranding an unusable final group.
     */
    const selection = selectFleeBloodbathEvent(
      state,
      round,
      remainingTributes,
      usedDefinitionIds,
      random,
      recordDiagnostics,
    );

    if (!selection) {
      throw new Error(
        "No eligible Bloodbath flee event could exactly cover the remaining tributes.",
      );
    }

    const event = resolveBloodbathEvent({
      state,
      round,
      livingTributes,
      definition: selection.definition,
      participantsByRole: selection.participantsByRole,
      eventIndex,
      feedGroup: "bloodbath-flee",
      random,
      unavailableItemInstanceIds,
    });

    if (usedDefinitionIds.has(selection.definition.id)) {
      throw new Error(
        `Bloodbath flee definition "${selection.definition.id}" was selected more than once.`,
      );
    }

    usedDefinitionIds.add(selection.definition.id);
    events.push(event);
    eventIndex += 1;
  }

  return events;
}

function assertUniqueEventDefinitions(events: readonly ResolvedEvent[]): void {
  const definitionIds = events.map((event) => event.definitionId);

  if (new Set(definitionIds).size !== definitionIds.length) {
    const repeatedDefinitionIds = [
      ...new Set(
        definitionIds.filter(
          (definitionId, index) => definitionIds.indexOf(definitionId) !== index,
        ),
      ),
    ];

    throw new Error(
      `Bloodbath sequencing repeated event definitions: ${repeatedDefinitionIds.join(", ")}.`,
    );
  }
}

function assertParticipantCoverage(
  livingTributes: readonly GameTribute[],
  cornucopiaTributeIds: ReadonlySet<string>,
  events: readonly ResolvedEvent[],
): void {
  const livingTributeIds = new Set(livingTributes.map((tribute) => tribute.id));
  const appearanceCounts = new Map<string, number>();
  const eliminatedTributeIds = new Set<string>();

  for (const event of events) {
    for (const tributeId of event.participantTributeIds) {
      if (!livingTributeIds.has(tributeId)) {
        throw new Error("A Bloodbath event references a tribute outside the starting roster.");
      }

      if (eliminatedTributeIds.has(tributeId)) {
        throw new Error(`Dead tribute "${tributeId}" was assigned to a later Bloodbath event.`);
      }

      const nextAppearanceCount = (appearanceCounts.get(tributeId) ?? 0) + 1;

      if (nextAppearanceCount > 2) {
        throw new Error(`Tribute "${tributeId}" appeared in more than two Bloodbath events.`);
      }

      if (nextAppearanceCount > 1 && !cornucopiaTributeIds.has(tributeId)) {
        throw new Error(
          `Fleeing tribute "${tributeId}" appeared in more than one Bloodbath event.`,
        );
      }

      appearanceCounts.set(tributeId, nextAppearanceCount);
    }

    for (const change of event.changes) {
      if (change.type === "eliminate-tribute") {
        eliminatedTributeIds.add(change.tributeId);
      }
    }
  }

  const uncoveredTributeIds = livingTributes
    .map((tribute) => tribute.id)
    .filter((tributeId) => !appearanceCounts.has(tributeId));

  if (uncoveredTributeIds.length > 0) {
    throw new Error(
      `Bloodbath sequencing did not cover every starting tribute: ${uncoveredTributeIds.join(", ")}.`,
    );
  }
}

export function sequenceBloodbathEvents(state: GameState, round: RoundReference): ResolvedEvent[] {
  if (round.day !== 1 || round.period !== "day") {
    throw new Error("The Bloodbath sequencer may only run during Day 1 daytime.");
  }

  const livingTributes = state.tributes.filter((tribute) => tribute.isAlive);

  if (livingTributes.length <= 1) {
    return [];
  }

  const roundSeed = createRoundSeed(state.seed, round);
  const random = createSeededRandom(roundSeed);

  const strategyPlan = assignBloodbathStrategies(livingTributes, random);

  const fatalityTarget = determineBloodbathFatalityTarget(livingTributes.length, random);

  const strategyByTributeId = new Map(
    strategyPlan.assignments.map(({ tributeId, strategy }) => [tributeId, strategy] as const),
  );

  const cornucopiaTributes = livingTributes.filter(
    (tribute) => strategyByTributeId.get(tribute.id) === "cornucopia",
  );

  const fleeingTributes = livingTributes.filter(
    (tribute) => strategyByTributeId.get(tribute.id) === "flee",
  );

  if (cornucopiaTributes.length !== strategyPlan.cornucopiaCount) {
    throw new Error("Bloodbath strategy assignment produced an invalid Cornucopia count.");
  }

  /*
   * Flee events use their own deterministic stream so they can be
   * resolved once for fatality planning and replayed later with their
   * final event indices. The replay must produce the same immediate
   * death count; an assertion below protects that contract.
   */
  const fleeSeed = `${roundSeed}:bloodbath-flee`;
  const fleePlanningEvents = sequenceFleeEvents(
    state,
    round,
    livingTributes,
    fleeingTributes,
    0,
    createSeededRandom(fleeSeed),
    new Set<string>(),
    false,
  );
  const fleePlanningChanges = fleePlanningEvents.flatMap((event) => event.changes);
  const cornucopiaFatalityTarget = getRemainingBloodbathFatalityTarget(
    fatalityTarget,
    fleePlanningChanges,
  );

  const unavailableItemInstanceIds = new Set<string>();

  const cornucopiaSequence = sequenceCornucopiaEvents(
    state,
    round,
    livingTributes,
    cornucopiaTributes,
    cornucopiaFatalityTarget,
    0,
    random,
    unavailableItemInstanceIds,
  );

  const fleeEvents = sequenceFleeEvents(
    state,
    round,
    livingTributes,
    fleeingTributes,

    cornucopiaSequence.nextEventIndex,

    createSeededRandom(fleeSeed),
    unavailableItemInstanceIds,
  );

  const plannedFleeEliminationCount = countResolvedEventEliminations(fleePlanningEvents);
  const resolvedFleeEliminationCount = countResolvedEventEliminations(fleeEvents);

  if (plannedFleeEliminationCount !== resolvedFleeEliminationCount) {
    throw new Error(
      "Deterministic flee-event replay changed the planned Bloodbath elimination count.",
    );
  }

  /*
   * Both sequence functions already randomize their participants.
   *
   * Keep the two strategy groups contiguous so the arena feed can
   * present the Cornucopia events first and the fleeing events second.
   */
  const events = [...cornucopiaSequence.events, ...fleeEvents];

  assertParticipantCoverage(
    livingTributes,
    new Set(cornucopiaTributes.map((tribute) => tribute.id)),
    events,
  );
  assertUniqueEventDefinitions(events);

  return events;
}
