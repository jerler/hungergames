import {
  countPlannedEliminations,
  determineBloodbathFatalityTarget,
  getRemainingBloodbathFatalityTarget,
} from "~/game/bloodbath/bloodbath-balance";
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
} from "~/game/events/catalogue/bloodbath";
import { isEventDefinitionEligible } from "~/game/events/event-eligibility";
import type {
  EventDefinition,
  EventSelectionContext,
  ParticipantsByRole,
} from "~/game/events/event-schema";
import { getEventDefinitionWeight } from "~/game/events/event-weighting";
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

function addCornucopiaProvisions(
  event: ResolvedEvent,
  tributes: readonly GameTribute[],
): ResolvedEvent {
  const eliminatedTributeIds = new Set(
    event.changes.flatMap((change) =>
      change.type === "eliminate-tribute" ? [change.tributeId] : [],
    ),
  );

  const tributeById = new Map(tributes.map((tribute) => [tribute.id, tribute] as const));

  const survivors = event.participantTributeIds
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

function selectDefinition(
  definitions: readonly EventDefinition[],
  context: EventSelectionContext,
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
): EventDefinition | null {
  const eligibleDefinitions = definitions.filter(
    (definition) =>
      !usedDefinitionIds.has(definition.id) && isEventDefinitionEligible(definition, context),
  );

  if (eligibleDefinitions.length === 0) {
    return null;
  }

  return selectWeightedItem(
    eligibleDefinitions,
    (definition) => getEventDefinitionWeight(definition, context),
    random,
  );
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

interface BloodbathAcquisitionSelection {
  definition: EventDefinition;

  participantsByRole: ParticipantsByRole;
}

interface CornucopiaSequenceResult {
  events: ResolvedEvent[];
  nextEventIndex: number;
  plannedEliminationCount: number;
}

function selectBloodbathAcquisitionEvent(
  state: GameState,
  round: RoundReference,
  remainingTributes: GameTribute[],
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
): BloodbathAcquisitionSelection | null {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };

  let candidateDefinitions = [
    ...CORNUCOPIA_ACQUISITION_EVENTS,
    ...CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  ].filter(
    (definition) =>
      !usedDefinitionIds.has(definition.id) &&
      isEventDefinitionEligible(definition, context) &&
      (definition.tags as readonly string[]).includes("weapon"),
  );

  while (candidateDefinitions.length > 0) {
    const definition = selectWeightedItem(
      candidateDefinitions,
      (candidate) => getEventDefinitionWeight(candidate, context),
      random,
    );

    const selection = selectEventParticipants(definition, context, random, new Set<string>());

    if (!selection) {
      candidateDefinitions = candidateDefinitions.filter(
        (candidate) => candidate.id !== definition.id,
      );
      continue;
    }

    if (selection.participantTributeIds.length !== 1) {
      throw new Error(
        `Bloodbath acquisition event "${definition.id}" selected ${selection.participantTributeIds.length} participants; expected exactly one.`,
      );
    }

    const selectedTributeId = selection.participantTributeIds[0];

    if (!selectedTributeId) {
      throw new Error(`Bloodbath acquisition event "${definition.id}" selected no participant.`);
    }

    const selectedIndex = remainingTributes.findIndex(
      (tribute) => tribute.id === selectedTributeId,
    );

    if (selectedIndex < 0) {
      throw new Error(
        `Bloodbath acquisition event "${definition.id}" selected unavailable tribute "${selectedTributeId}".`,
      );
    }

    remainingTributes.splice(selectedIndex, 1);

    return {
      definition,
      participantsByRole: selection.participantsByRole,
    };
  }

  return null;
}

function getMinimumUniqueFatalSurvivorBudget(fatalityTarget: number): number {
  if (fatalityTarget <= 3) {
    return 0;
  }

  if (fatalityTarget <= 5) {
    return 1;
  }

  if (fatalityTarget <= 7) {
    return 2;
  }

  if (fatalityTarget <= 9) {
    return 4;
  }

  return fatalityTarget - 5;
}

function getDefinitionParticipantCount(definition: EventDefinition): number {
  return definition.roles.reduce((total, role) => total + role.count, 0);
}

function collectBloodbathDiagnosticFeasibleDefinitions({
  state,
  round,
  remainingTributes,
  definitions,
  usedDefinitionIds,
  poolId,
  stage,
  diagnosticKey,
  getHardRejectionReason,
}: {
  state: GameState;
  round: RoundReference;
  remainingTributes: readonly GameTribute[];
  definitions: readonly EventDefinition[];
  usedDefinitionIds: ReadonlySet<string>;
  poolId: EventSelectionDiagnosticPoolId;
  stage: EventSelectionDiagnosticStage;
  diagnosticKey: string;
  getHardRejectionReason?: (definition: EventDefinition) => EventSelectionRejectionReason | null;
}): EventDefinition[] {
  if (!isEventSelectionDiagnosticsActive()) {
    return [];
  }

  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };
  const uniqueDefinitions = [
    ...new Map(definitions.map((definition) => [definition.id, definition])).values(),
  ];
  const feasibleDefinitions: EventDefinition[] = [];

  for (const definition of uniqueDefinitions) {
    let rejectionReason: EventSelectionRejectionReason | null;

    if (usedDefinitionIds.has(definition.id)) {
      rejectionReason = "already-used-definition";
    } else if (!isEventDefinitionEligible(definition, context)) {
      rejectionReason = "definition-ineligible";
    } else {
      rejectionReason = getHardRejectionReason?.(definition) ?? null;
    }

    if (rejectionReason) {
      recordEventSelectionCandidateEvaluation({
        poolId,
        stage,
        definition,
        eligible: rejectionReason !== "definition-ineligible",
        feasible: false,
        rejectionReason,
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
        feasible: false,
        rejectionReason: "participant-or-item-infeasible",
      });
      continue;
    }

    recordEventSelectionCandidateEvaluation({
      poolId,
      stage,
      definition,
      eligible: true,
      feasible: true,
    });
    feasibleDefinitions.push(definition);
  }

  return feasibleDefinitions;
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

function selectBloodbathEventForRemainingTributes(
  definitions: readonly EventDefinition[],
  state: GameState,
  round: RoundReference,
  remainingTributes: GameTribute[],
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
): BloodbathAcquisitionSelection | null {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };

  let candidateDefinitions = definitions.filter(
    (definition) =>
      !usedDefinitionIds.has(definition.id) &&
      getDefinitionParticipantCount(definition) <= remainingTributes.length &&
      isEventDefinitionEligible(definition, context),
  );

  while (candidateDefinitions.length > 0) {
    const definition = selectWeightedItem(
      candidateDefinitions,
      (candidate) => getEventDefinitionWeight(candidate, context),
      random,
    );
    const selection = selectEventParticipants(definition, context, random, new Set<string>());

    if (!selection) {
      candidateDefinitions = candidateDefinitions.filter(
        (candidate) => candidate.id !== definition.id,
      );
      continue;
    }

    removeSelectedBloodbathParticipants(
      remainingTributes,
      selection.participantTributeIds,
      definition.id,
    );

    return {
      definition,
      participantsByRole: selection.participantsByRole,
    };
  }

  return null;
}

function selectAuthoredFatalBloodbathEvent(
  state: GameState,
  round: RoundReference,
  remainingTributes: GameTribute[],
  fatalityDeficit: number,
  reservedPostTargetCount: number,
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
): BloodbathAcquisitionSelection | null {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes: remainingTributes,
  };

  /*
   * The authored catalogue and the original conflict families share
   * one planning pool. Delayed bleeding and poison events remain in
   * the post-target pool because they do not contribute an immediate
   * Day 1 elimination.
   */
  const fatalSelectionProfiles = [
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
  ];

  const availableFatalParticipants = Math.max(
    0,
    remainingTributes.length - reservedPostTargetCount,
  );

  /*
   * This is the number of survivors the fatal phase may spend while
   * still leaving enough participants to reach the current soft goal.
   *
   * Example: with seven fatal-phase participants and a five-death
   * deficit, events may collectively leave at most two survivors.
   */
  const fatalSurvivorBudget = Math.max(0, availableFatalParticipants - fatalityDeficit);
  const diagnosticFeasibleDefinitions = collectBloodbathDiagnosticFeasibleDefinitions({
    state,
    round,
    remainingTributes,
    definitions: fatalSelectionProfiles.map((profile) => profile.definition),
    usedDefinitionIds,
    poolId: "bloodbath-cornucopia",
    stage: "cornucopia-fatal",
    diagnosticKey: [
      "fatal",
      remainingTributes.length,
      fatalityDeficit,
      reservedPostTargetCount,
    ].join(":"),
    getHardRejectionReason: (definition) => {
      const profile = fatalSelectionProfiles.find(
        (candidate) => candidate.definition.id === definition.id,
      );

      if (!profile) {
        return "participant-or-item-infeasible";
      }

      const participantCount = getDefinitionParticipantCount(definition);
      const worstCaseSurvivorCost = participantCount - profile.minImmediateEliminations;

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
    },
  });
  const plannerConsideredDefinitionIds = new Set<string>();
  const finishSelection = (
    selection: BloodbathAcquisitionSelection | null,
  ): BloodbathAcquisitionSelection | null => {
    recordEventSelectionOpportunity({
      poolId: "bloodbath-cornucopia",
      stage: "cornucopia-fatal",
      feasibleDefinitions: diagnosticFeasibleDefinitions,
      selectedDefinition: selection?.definition ?? null,
      plannerConsideredDefinitionIds,
    });

    return selection;
  };

  const candidateProfiles = fatalSelectionProfiles.filter((profile) => {
    const participantCount = getDefinitionParticipantCount(profile.definition);
    const worstCaseSurvivorCost = participantCount - profile.minImmediateEliminations;

    return (
      !usedDefinitionIds.has(profile.definition.id) &&
      participantCount <= availableFatalParticipants &&
      /*
       * The target is deliberately soft. Permit at most one planned
       * death beyond the current deficit so two-death events can close
       * a one-death gap without creating a large overshoot.
       */
      profile.maxImmediateEliminations <= fatalityDeficit + 1 &&
      worstCaseSurvivorCost <= fatalSurvivorBudget &&
      isEventDefinitionEligible(profile.definition, context)
    );
  });

  function selectFromProfiles(
    profiles: typeof candidateProfiles,
  ): BloodbathAcquisitionSelection | null {
    for (const profile of profiles) {
      plannerConsideredDefinitionIds.add(profile.definition.id);
    }

    let remainingProfiles = [...profiles];

    while (remainingProfiles.length > 0) {
      const profile = selectWeightedItem(
        remainingProfiles,
        (candidate) => getEventDefinitionWeight(candidate.definition, context),
        random,
      );

      const selection = selectEventParticipants(
        profile.definition,
        context,
        random,
        new Set<string>(),
      );

      if (!selection) {
        remainingProfiles = remainingProfiles.filter(
          (candidate) => candidate.definition.id !== profile.definition.id,
        );
        continue;
      }

      removeSelectedBloodbathParticipants(
        remainingTributes,
        selection.participantTributeIds,
        profile.definition.id,
      );

      return {
        definition: profile.definition,
        participantsByRole: selection.participantsByRole,
      };
    }

    return null;
  }

  const efficientMultiDeathProfiles = candidateProfiles.filter(
    (profile) =>
      profile.minImmediateEliminations >= 2 &&
      getDefinitionParticipantCount(profile.definition) === 3,
  );

  const expensiveMultiDeathProfiles = candidateProfiles.filter(
    (profile) =>
      profile.minImmediateEliminations >= 2 &&
      getDefinitionParticipantCount(profile.definition) > 3,
  );

  const guaranteedOneDeathPairProfiles = candidateProfiles.filter(
    (profile) =>
      profile.minImmediateEliminations === 1 &&
      getDefinitionParticipantCount(profile.definition) > 1,
  );

  const variableMultiParticipantProfiles = candidateProfiles.filter(
    (profile) =>
      profile.minImmediateEliminations === 0 &&
      getDefinitionParticipantCount(profile.definition) > 1,
  );

  const soloProfiles = candidateProfiles.filter(
    ({ definition }) => getDefinitionParticipantCount(definition) === 1,
  );

  /*
   * The remaining unique solo definitions can finish this many deaths
   * without spending another survivor. Use larger fatalities only for
   * the portion of the deficit that the solo pool cannot cover.
   */
  const deathsBeyondSoloCapacity = Math.max(0, fatalityDeficit - soloProfiles.length);

  if (deathsBeyondSoloCapacity > 0) {
    const efficientMultiDeath = selectFromProfiles(efficientMultiDeathProfiles);

    if (efficientMultiDeath) {
      return finishSelection(efficientMultiDeath);
    }

    const expensiveMultiDeath = selectFromProfiles(expensiveMultiDeathProfiles);

    if (expensiveMultiDeath) {
      return finishSelection(expensiveMultiDeath);
    }

    const guaranteedPair = selectFromProfiles(guaranteedOneDeathPairProfiles);

    if (guaranteedPair) {
      return finishSelection(guaranteedPair);
    }
  }

  /*
   * Once the unique solo pool can finish the target, use it directly.
   * This prevents an unnecessary pair event from consuming the final
   * survivor budget and making the target unreachable.
   */
  const soloSelection = selectFromProfiles(soloProfiles);

  if (soloSelection) {
    return finishSelection(soloSelection);
  }

  /*
   * These are last-resort unique fallbacks. Variable conflict events
   * remain reachable, but they cannot displace the guaranteed sequence
   * required to preserve the established fatality range.
   */
  return finishSelection(
    selectFromProfiles(guaranteedOneDeathPairProfiles) ??
      selectFromProfiles(variableMultiParticipantProfiles) ??
      selectFromProfiles(expensiveMultiDeathProfiles) ??
      selectFromProfiles(efficientMultiDeathProfiles),
  );
}

const RARE_CORNUCOPIA_BONUS_ITEM_CHANCE = 0.1;

function normalizeCornucopiaAcquisitions(
  event: ResolvedEvent,
  tributes: readonly GameTribute[],
  random: RandomSource,
): ResolvedEvent {
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

function takeRemainingTributes(
  remainingTributes: GameTribute[],
  count: number,
  label: string,
): GameTribute[] {
  const selectedTributes = remainingTributes.splice(0, count);

  if (selectedTributes.length !== count) {
    throw new Error(
      `Bloodbath post-target ${label} selection expected ${count} tributes but received ${selectedTributes.length}.`,
    );
  }

  return selectedTributes;
}

function selectPostTargetCornucopiaEvent(
  state: GameState,
  round: RoundReference,
  livingTributes: readonly GameTribute[],
  remainingTributes: GameTribute[],
  usedDefinitionIds: ReadonlySet<string>,
  random: RandomSource,
): BloodbathAcquisitionSelection {
  const context: EventSelectionContext = {
    state,
    round,
    livingTributes,
  };
  const postTargetDefinitions = [
    ...CORNUCOPIA_GROUP_CONFLICT_EVENTS,
    ...CORNUCOPIA_PAIR_CONFLICT_EVENTS,
    ...CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
    ...CORNUCOPIA_NONFATAL_TRIO_EVENTS,
    ...CORNUCOPIA_NONFATAL_PAIR_EVENTS,
    ...CORNUCOPIA_FATAL_DELAYED_EVENTS,
    ...CORNUCOPIA_ACQUISITION_EVENTS,
    ...CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  ];
  const diagnosticFeasibleDefinitions = collectBloodbathDiagnosticFeasibleDefinitions({
    state,
    round,
    remainingTributes,
    definitions: postTargetDefinitions,
    usedDefinitionIds,
    poolId: "bloodbath-cornucopia",
    stage: "cornucopia-post-target",
    diagnosticKey: ["post-target", remainingTributes.length].join(":"),
    getHardRejectionReason: (definition) =>
      getDefinitionParticipantCount(definition) > remainingTributes.length
        ? "participant-count-unavailable"
        : null,
  });
  const plannerConsideredDefinitionIds = new Set<string>();
  const markPlannerDefinitions = (definitions: readonly EventDefinition[]): void => {
    for (const definition of definitions) {
      plannerConsideredDefinitionIds.add(definition.id);
    }
  };
  const finishSelection = (
    selection: BloodbathAcquisitionSelection | null,
  ): BloodbathAcquisitionSelection | null => {
    recordEventSelectionOpportunity({
      poolId: "bloodbath-cornucopia",
      stage: "cornucopia-post-target",
      feasibleDefinitions: diagnosticFeasibleDefinitions,
      selectedDefinition: selection?.definition ?? null,
      plannerConsideredDefinitionIds,
    });

    return selection;
  };

  /*
   * Preserve the original conflict catalogues as post-target volatility.
   *
   * Strict definition uniqueness made these families unreachable in the
   * fatal-target planner because the guaranteed authored profiles always
   * satisfied the target first. Full Games still commonly preserve a
   * two-to-four-person post-target group, which is the correct place for
   * these uncertain conflicts:
   *
   * - three or four remaining: try one unused group conflict;
   * - two remaining: try one unused pair conflict;
   * - otherwise continue through the ordinary post-target shapes.
   *
   * Their actual deaths are counted normally. No outcome is rerolled and
   * the shared usedDefinitionIds set still prevents repeated prose.
   */
  if (livingTributes.length > 12 && remainingTributes.length >= 3) {
    markPlannerDefinitions(CORNUCOPIA_GROUP_CONFLICT_EVENTS);
    const groupConflictSelection = selectBloodbathEventForRemainingTributes(
      CORNUCOPIA_GROUP_CONFLICT_EVENTS,
      state,
      round,
      remainingTributes,
      usedDefinitionIds,
      random,
    );

    if (groupConflictSelection) {
      return finishSelection(groupConflictSelection) as BloodbathAcquisitionSelection;
    }
  }

  if (livingTributes.length > 12 && remainingTributes.length >= 2) {
    markPlannerDefinitions(CORNUCOPIA_PAIR_CONFLICT_EVENTS);
    const pairConflictSelection = selectBloodbathEventForRemainingTributes(
      CORNUCOPIA_PAIR_CONFLICT_EVENTS,
      state,
      round,
      remainingTributes,
      usedDefinitionIds,
      random,
    );

    if (pairConflictSelection) {
      return finishSelection(pairConflictSelection) as BloodbathAcquisitionSelection;
    }
  }

  /*
   * Prefer the largest feasible unused event shape.
   *
   * This minimizes the number of post-target cards and prevents the
   * small solo-acquisition pool from being exhausted merely because
   * the weighted shape roll repeatedly chose "solo".
   */
  if (remainingTributes.length >= 4) {
    markPlannerDefinitions(CORNUCOPIA_NONFATAL_QUARTET_EVENTS);
    const definition = selectDefinition(
      CORNUCOPIA_NONFATAL_QUARTET_EVENTS,
      context,
      usedDefinitionIds,
      random,
    );

    if (definition) {
      return finishSelection({
        definition,
        participantsByRole: {
          tributes: takeRemainingTributes(remainingTributes, 4, "quartet"),
        },
      }) as BloodbathAcquisitionSelection;
    }
  }

  if (remainingTributes.length >= 3) {
    markPlannerDefinitions(CORNUCOPIA_NONFATAL_TRIO_EVENTS);
    const definition = selectDefinition(
      CORNUCOPIA_NONFATAL_TRIO_EVENTS,
      context,
      usedDefinitionIds,
      random,
    );

    if (definition) {
      return finishSelection({
        definition,
        participantsByRole: {
          tributes: takeRemainingTributes(remainingTributes, 3, "trio"),
        },
      }) as BloodbathAcquisitionSelection;
    }
  }

  if (remainingTributes.length >= 2) {
    const preferDelayedFatal = random() < 0.08;

    const preferredDefinitions = preferDelayedFatal
      ? CORNUCOPIA_FATAL_DELAYED_EVENTS
      : CORNUCOPIA_NONFATAL_PAIR_EVENTS;

    const fallbackDefinitions = preferDelayedFatal
      ? CORNUCOPIA_NONFATAL_PAIR_EVENTS
      : CORNUCOPIA_FATAL_DELAYED_EVENTS;

    markPlannerDefinitions(preferredDefinitions);
    let pairSelection = selectBloodbathEventForRemainingTributes(
      preferredDefinitions,
      state,
      round,
      remainingTributes,
      usedDefinitionIds,
      random,
    );

    if (!pairSelection) {
      markPlannerDefinitions(fallbackDefinitions);
      pairSelection = selectBloodbathEventForRemainingTributes(
        fallbackDefinitions,
        state,
        round,
        remainingTributes,
        usedDefinitionIds,
        random,
      );
    }

    if (pairSelection) {
      return finishSelection(pairSelection) as BloodbathAcquisitionSelection;
    }
  }

  markPlannerDefinitions([
    ...CORNUCOPIA_ACQUISITION_EVENTS,
    ...CORNUCOPIA_FLAVOUR_ACQUISITION_EVENTS,
  ]);
  const soloSelection = selectBloodbathAcquisitionEvent(
    state,
    round,
    remainingTributes,
    usedDefinitionIds,
    random,
  );

  if (soloSelection) {
    return finishSelection(soloSelection) as BloodbathAcquisitionSelection;
  }

  finishSelection(null);

  throw new Error(
    `No unused Bloodbath event definition could cover ${remainingTributes.length} remaining Cornucopia tribute(s).`,
  );
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

  /*
   * The target is intentionally soft. Most games aim at the seeded
   * planning target, while a smaller share stop one or two deaths
   * earlier. This preserves meaningful variation instead of forcing
   * an identical Bloodbath total for every Half Game.
   */
  const targetReductionRoll = random();
  const targetReduction = targetReductionRoll < 0.1 ? 2 : targetReductionRoll < 0.35 ? 1 : 0;
  const softFatalityTarget = Math.max(0, fatalityTarget - targetReduction);

  /*
   * Reserve a seeded one-to-four-person group for the acquisition and
   * non-fatal Cornucopia catalogues. These tributes are not special;
   * the reservation only prevents the fatal phase from consuming the
   * complete Cornucopia roster before post-target selection can run.
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

  const requiredFatalSurvivorBudget = getMinimumUniqueFatalSurvivorBudget(softFatalityTarget);

  /*
   * Preserve a post-target Cornucopia group whenever possible.
   *
   * Under strict definition uniqueness, some Full Games need every
   * Cornucopia participant to reach the existing fatality target.
   * In those cases only, permit the reservation to fall to zero rather
   * than silently undershooting the Bloodbath balance contract.
   */
  const maximumReservationThatPreservesTarget = Math.max(
    0,
    remainingTributes.length - softFatalityTarget - requiredFatalSurvivorBudget,
  );

  const reservedPostTargetCount = Math.min(
    requestedPostTargetCount,
    maximumReservationThatPreservesTarget,
  );

  while (remainingTributes.length > 0) {
    const fatalityDeficit = softFatalityTarget - plannedEliminationCount;

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
    const shouldTryFatalEvent =
      fatalityDeficit > 0 && remainingTributes.length > reservedPostTargetCount;
    const fatalSelection = shouldTryFatalEvent
      ? selectAuthoredFatalBloodbathEvent(
          state,
          round,
          remainingTributes,
          fatalityDeficit,
          reservedPostTargetCount,
          usedDefinitionIds,
          random,
        )
      : null;

    if (fatalSelection) {
      definition = fatalSelection.definition;
      participantsByRole = fatalSelection.participantsByRole;
    } else {
      const postTargetSelection = selectPostTargetCornucopiaEvent(
        state,
        round,
        livingTributes,
        remainingTributes,
        usedDefinitionIds,
        random,
      );

      definition = postTargetSelection.definition;
      participantsByRole = postTargetSelection.participantsByRole;
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
    );

    const event = addCornucopiaProvisions(eventWithPossibleBonus, livingTributes);

    plannedEliminationCount += countPlannedEliminations(event.changes);

    if (usedDefinitionIds.has(definition.id)) {
      throw new Error(`Bloodbath event definition "${definition.id}" was selected more than once.`);
    }

    usedDefinitionIds.add(definition.id);
    events.push(event);

    eventIndex += 1;
  }

  return {
    events,
    nextEventIndex: eventIndex,
    plannedEliminationCount,
  };
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
    const diagnosticFeasibleDefinitions = recordDiagnostics
      ? collectBloodbathDiagnosticFeasibleDefinitions({
          state,
          round,
          remainingTributes,
          definitions: FLEE_EVENTS,
          usedDefinitionIds,
          poolId: "bloodbath-flee",
          stage: "flee",
          diagnosticKey: ["flee", remainingTributes.length].join(":"),
          getHardRejectionReason: (definition) =>
            getDefinitionParticipantCount(definition) > remainingTributes.length
              ? "participant-count-unavailable"
              : null,
        })
      : [];

    /*
     * Most flee events consume one tribute, while the crowd-breakaway
     * truce event consumes two. The shared remaining-participant
     * selector filters out definitions whose role counts no longer fit
     * and removes every selected participant exactly once.
     */
    const selection = selectBloodbathEventForRemainingTributes(
      FLEE_EVENTS,
      state,
      round,
      remainingTributes,
      usedDefinitionIds,
      random,
    );

    if (recordDiagnostics) {
      recordEventSelectionOpportunity({
        poolId: "bloodbath-flee",
        stage: "flee",
        feasibleDefinitions: diagnosticFeasibleDefinitions,
        selectedDefinition: selection?.definition ?? null,
        plannerConsideredDefinitionIds: new Set(FLEE_EVENTS.map((definition) => definition.id)),
      });
    }

    if (!selection) {
      throw new Error("No eligible Bloodbath flee event could cover the remaining tributes.");
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
  events: readonly ResolvedEvent[],
): void {
  const participantIds = events.flatMap((event) => event.participantTributeIds);

  if (participantIds.length !== livingTributes.length) {
    throw new Error("Bloodbath sequencing did not cover every living tribute exactly once.");
  }

  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("A tribute was assigned to more than one Bloodbath event.");
  }

  const livingTributeIds = new Set(livingTributes.map((tribute) => tribute.id));

  if (participantIds.some((tributeId) => !livingTributeIds.has(tributeId))) {
    throw new Error("A Bloodbath event references a tribute outside the starting roster.");
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

  assertParticipantCoverage(livingTributes, events);
  assertUniqueEventDefinitions(events);

  return events;
}
