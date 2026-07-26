import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createSeededRandom, type RandomSource } from "~/game/engine/random";
import { createStatusChange } from "~/game/events/event-change-builders";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import type { StatCheckOutcome } from "~/game/events/event-outcomes";
import type { AccessibleInventoryItem } from "~/game/items/inventory-engine";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type {
  GameChange,
  GameState,
  GameTribute,
  PreparationMechanic,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";
import { findMedicalTreatmentPlan, type MedicalTreatmentPlan } from "./medical-treatment-planner";
import type { NightRestQuality } from "./survival-schema";
import {
  findCamouflagePreparationPlan,
  resolveCamouflagePreparationAttempt,
  type CamouflagePreparationPlan,
} from "./camouflage-preparation";

export interface PreparedRound {
  state: GameState;
  automaticEvents: ResolvedEvent[];
  committedItemInstanceIds: Set<string>;
}

function compareTributes(first: GameTribute, second: GameTribute): number {
  return (
    first.district - second.district ||
    first.districtPosition - second.districtPosition ||
    first.id.localeCompare(second.id)
  );
}

function getStableLivingTributeIds(state: GameState): string[] {
  return state.tributes
    .filter((tribute) => tribute.isAlive)
    .sort(compareTributes)
    .map((tribute) => tribute.id);
}

function requireLivingTribute(state: GameState, tributeId: string): GameTribute {
  const tribute = state.tributes.find(
    (candidate) => candidate.id === tributeId && candidate.isAlive,
  );

  if (!tribute) {
    throw new Error(`Preparation could not find living tribute "${tributeId}".`);
  }

  return tribute;
}

function uniqueStatusIds(statusIds: readonly StatusEffectId[]): StatusEffectId[] {
  return [...new Set(statusIds)];
}

export function createPreparationSeed(
  gameSeed: string,
  round: RoundReference,
  mechanic: PreparationMechanic,
  tributeId: string,
): string {
  return [gameSeed, round.period, round.day, mechanic, tributeId].join(":");
}

export function createPreparationRandom(
  gameSeed: string,
  round: RoundReference,
  mechanic: PreparationMechanic,
  tributeId: string,
): RandomSource {
  return createSeededRandom(createPreparationSeed(gameSeed, round, mechanic, tributeId));
}

function createPreparationEventId(
  round: RoundReference,
  mechanic: PreparationMechanic,
  tributeId: string,
): string {
  return ["preparation", round.period, round.day, mechanic, tributeId].join(":");
}

function getUsesRemainingAfter(selection: AccessibleInventoryItem): number | null {
  const usesRemaining = selection.item.usesRemaining;

  return usesRemaining === null ? null : Math.max(0, usesRemaining - 1);
}

function getEventParticipantIds(
  actingTribute: GameTribute,
  selection?: AccessibleInventoryItem,
): string[] {
  if (!selection || selection.owner.id === actingTribute.id) {
    return [actingTribute.id];
  }

  return [actingTribute.id, selection.owner.id];
}

function getItemPhrase(actingTribute: GameTribute, selection: AccessibleInventoryItem): string {
  const label = getItemDefinition(selection.item.definitionId).label.toLowerCase();

  if (selection.owner.id === actingTribute.id) {
    return `their ${label}`;
  }

  return `${selection.owner.snapshot.name}'s ` + label;
}

function getMedicalConditionPhrase(statusId: StatusEffectId): string {
  switch (statusId) {
    case "injured":
      return "their injuries";

    case "bleeding":
      return "their bleeding";

    case "poisoned":
      return "their poisoning";

    case "burned":
      return "their burns";

    default:
      throw new Error(`Cannot describe non-medical status "${statusId}" as a medical condition.`);
  }
}

function createMedicalTreatmentText(patient: GameTribute, plan: MedicalTreatmentPlan): string {
  const itemPhrase = getItemPhrase(patient, plan.selection);

  const conditionPhrase = getMedicalConditionPhrase(plan.targetStatus.definitionId);

  return `${patient.snapshot.name} uses ` + `${itemPhrase} to treat ` + `${conditionPhrase}.`;
}

function createMedicalTreatmentEvent(
  state: GameState,
  round: RoundReference,
  patient: GameTribute,
  plan: MedicalTreatmentPlan,
): ResolvedEvent {
  const eventId = createPreparationEventId(round, "medical-treatment", patient.id);

  const changes = compileItemUseEffects({
    eventId,
    round,

    random: createPreparationRandom(state.seed, round, "medical-treatment", patient.id),

    actingTribute: patient,

    owner: plan.selection.owner,

    item: plan.selection.item,

    reason: eventId,
  });

  return {
    id: eventId,

    definitionId: "automatic-medical-treatment",

    kind: "preparation",

    resolutionMode: "standard",

    round,

    participantTributeIds: getEventParticipantIds(patient, plan.selection),

    text: createMedicalTreatmentText(patient, plan),

    changes,

    preparation: {
      mechanic: "medical-treatment",

      actingTributeId: patient.id,

      itemInstanceId: plan.selection.item.id,

      itemDefinitionId: plan.selection.item.definitionId,

      itemOwnerTributeId: plan.selection.owner.id,

      usesRemainingAfter: getUsesRemainingAfter(plan.selection),

      affectedStatusIds: [...plan.treatedStatusIds],
    },
  };
}

function prepareMedicalTreatments(
  preparedRound: PreparedRound,
  round: RoundReference,
): PreparedRound {
  let nextPreparedRound = preparedRound;

  const tributeIds = getStableLivingTributeIds(nextPreparedRound.state);

  for (const tributeId of tributeIds) {
    const patient = requireLivingTribute(nextPreparedRound.state, tributeId);

    const plan = findMedicalTreatmentPlan(
      nextPreparedRound.state,
      patient,
      nextPreparedRound.committedItemInstanceIds,
    );

    if (!plan) {
      continue;
    }

    const event = createMedicalTreatmentEvent(nextPreparedRound.state, round, patient, plan);

    nextPreparedRound = applyPreparationEvent(nextPreparedRound, event);
  }

  return nextPreparedRound;
}

function applyPreparationEvent(preparedRound: PreparedRound, event: ResolvedEvent): PreparedRound {
  const committedItemInstanceIds = new Set(preparedRound.committedItemInstanceIds);

  for (const itemInstanceId of getCommittedItemInstanceIds(event.changes)) {
    committedItemInstanceIds.add(itemInstanceId);
  }

  return {
    state: applyResolvedEvent(preparedRound.state, event),

    automaticEvents: [...preparedRound.automaticEvents, event],

    committedItemInstanceIds,
  };
}

function createCamouflagePreparationText(
  tribute: GameTribute,
  plan: CamouflagePreparationPlan,
  outcome: StatCheckOutcome,
): string {
  const itemPhrase = getItemPhrase(tribute, plan.selection);

  switch (outcome) {
    case "critical-failure":
      return (
        `${tribute.snapshot.name} tries to use ` +
        `${itemPhrase} for camouflage, but becomes ` +
        "hopelessly disoriented during the attempt."
      );

    case "failure":
      return (
        `${tribute.snapshot.name} applies ` +
        `${itemPhrase}, but the camouflage fails to ` +
        "match the surrounding terrain."
      );

    case "success":
      return (
        `${tribute.snapshot.name} uses ` + `${itemPhrase} to blend into the surrounding terrain.`
      );

    case "exceptional-success":
      return (
        `${tribute.snapshot.name} uses ` +
        `${itemPhrase} to disappear almost completely into the arena.`
      );
  }
}

function createCamouflagePreparationEvent(
  state: GameState,
  round: RoundReference,
  tribute: GameTribute,
  plan: CamouflagePreparationPlan,
): ResolvedEvent {
  const eventId = createPreparationEventId(round, "camouflage-preparation", tribute.id);

  const attempt = resolveCamouflagePreparationAttempt({
    eventId,
    round,

    random: createPreparationRandom(state.seed, round, "camouflage-preparation", tribute.id),

    tribute,
    plan,
  });

  return {
    id: eventId,

    definitionId: "automatic-camouflage-preparation",

    kind: "preparation",

    resolutionMode: "standard",

    round,

    participantTributeIds: getEventParticipantIds(tribute, plan.selection),

    text: createCamouflagePreparationText(tribute, plan, attempt.outcome),

    changes: attempt.changes,

    preparation: {
      mechanic: "camouflage-preparation",

      actingTributeId: tribute.id,

      itemInstanceId: plan.selection.item.id,

      itemDefinitionId: plan.selection.item.definitionId,

      itemOwnerTributeId: plan.selection.owner.id,

      usesRemainingAfter: getUsesRemainingAfter(plan.selection),

      affectedStatusIds: attempt.affectedStatusIds,
    },
  };
}

function prepareCamouflage(preparedRound: PreparedRound, round: RoundReference): PreparedRound {
  let nextPreparedRound = preparedRound;

  const tributeIds = getStableLivingTributeIds(nextPreparedRound.state);

  for (const tributeId of tributeIds) {
    const tribute = requireLivingTribute(nextPreparedRound.state, tributeId);

    const plan = findCamouflagePreparationPlan(
      nextPreparedRound.state,
      tribute,

      nextPreparedRound.committedItemInstanceIds,
    );

    if (!plan) {
      continue;
    }

    const event = createCamouflagePreparationEvent(nextPreparedRound.state, round, tribute, plan);

    nextPreparedRound = applyPreparationEvent(nextPreparedRound, event);
  }

  return nextPreparedRound;
}

function isPreviousNightRest(tribute: GameTribute, round: RoundReference): boolean {
  const rest = tribute.survival.lastNightRest;

  return (
    round.period === "day" &&
    round.day > 1 &&
    rest !== null &&
    rest.round.period === "night" &&
    rest.round.day === round.day - 1
  );
}

function getStatusInstanceIds(tribute: GameTribute, statusId: StatusEffectId): string[] {
  return tribute.statuses.flatMap((status) =>
    status.definitionId === statusId ? [status.id] : [],
  );
}

function createRemoveStatusChanges(tribute: GameTribute, statusId: StatusEffectId): GameChange[] {
  return getStatusInstanceIds(tribute, statusId).map((statusInstanceId) => ({
    type: "remove-status",
    tributeId: tribute.id,
    statusId: statusInstanceId,
  }));
}

function createMorningRestChanges(
  eventId: string,
  round: RoundReference,
  tribute: GameTribute,
  quality: NightRestQuality,
): GameChange[] {
  switch (quality) {
    case "comfortable":
      return [
        ...createRemoveStatusChanges(tribute, "exhausted"),

        /*
         * Replace yesterday's benefit rather
         * than stacking consecutive nights.
         */
        ...createRemoveStatusChanges(tribute, "well-rested"),

        createStatusChange(eventId, tribute, "well-rested", 2, round),
      ];

    case "sheltered":
      return [
        ...createRemoveStatusChanges(tribute, "exhausted"),

        /*
         * Replace yesterday's benefit rather
         * than stacking consecutive nights.
         */
        ...createRemoveStatusChanges(tribute, "well-rested"),

        createStatusChange(eventId, tribute, "well-rested", 1, round),
      ];

    case "unsheltered":
      return [
        ...createRemoveStatusChanges(tribute, "well-rested"),

        createStatusChange(eventId, tribute, "exhausted", 1, round),
      ];
  }
}

function getMorningAffectedStatusIds(
  tribute: GameTribute,
  quality: NightRestQuality,
): StatusEffectId[] {
  const hasExhausted = getStatusInstanceIds(tribute, "exhausted").length > 0;

  const hasWellRested = getStatusInstanceIds(tribute, "well-rested").length > 0;

  switch (quality) {
    case "comfortable":
      return uniqueStatusIds([...(hasExhausted ? ["exhausted" as const] : []), "well-rested"]);

    case "sheltered":
      return uniqueStatusIds([...(hasExhausted ? ["exhausted" as const] : []), "well-rested"]);

    case "unsheltered":
      return uniqueStatusIds([...(hasWellRested ? ["well-rested" as const] : []), "exhausted"]);
  }
}

function createMorningRestText(tribute: GameTribute, quality: NightRestQuality): string {
  switch (quality) {
    case "comfortable":
      return (
        `${tribute.snapshot.name} wakes fully restored ` + "after a comfortable night's sleep."
      );

    case "sheltered":
      return (
        `${tribute.snapshot.name} wakes rested after ` + "passing the night safely under shelter."
      );

    case "unsheltered":
      return `${tribute.snapshot.name} wakes exhausted ` + "after a cold and exposed night.";
  }
}

function createMorningRestResolutionEvent(
  round: RoundReference,
  tribute: GameTribute,
): ResolvedEvent {
  const rest = tribute.survival.lastNightRest;

  if (!rest) {
    throw new Error(`Tribute "${tribute.id}" has no night rest to resolve.`);
  }

  const eventId = createPreparationEventId(round, "morning-rest-resolution", tribute.id);

  return {
    id: eventId,
    definitionId: "automatic-morning-rest-resolution",

    kind: "preparation",
    resolutionMode: "standard",

    round,
    participantTributeIds: [tribute.id],

    text: createMorningRestText(tribute, rest.quality),

    changes: createMorningRestChanges(eventId, round, tribute, rest.quality),

    preparation: {
      mechanic: "morning-rest-resolution",

      actingTributeId: tribute.id,

      restQuality: rest.quality,

      affectedStatusIds: getMorningAffectedStatusIds(tribute, rest.quality),
    },
  };
}

function prepareMorningRestResolution(
  preparedRound: PreparedRound,
  round: RoundReference,
): PreparedRound {
  let nextPreparedRound = preparedRound;

  const tributeIds = getStableLivingTributeIds(nextPreparedRound.state);

  for (const tributeId of tributeIds) {
    const tribute = requireLivingTribute(nextPreparedRound.state, tributeId);

    if (!isPreviousNightRest(tribute, round)) {
      continue;
    }

    const event = createMorningRestResolutionEvent(round, tribute);

    nextPreparedRound = applyPreparationEvent(nextPreparedRound, event);
  }

  return nextPreparedRound;
}

export function prepareRound(state: GameState, round: RoundReference): PreparedRound {
  let preparedRound: PreparedRound = {
    state,
    automaticEvents: [],
    committedItemInstanceIds: new Set<string>(),
  };

  /*
   * Resolve urgent treatment before rest aftermath
   * or camouflage preparation.
   */
  preparedRound = prepareMedicalTreatments(preparedRound, round);

  if (round.period === "day") {
    preparedRound = prepareMorningRestResolution(preparedRound, round);
  }

  return prepareCamouflage(preparedRound, round);
}
