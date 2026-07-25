import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createSeededRandom, type RandomSource } from "~/game/engine/random";
import { createStatusChange } from "~/game/events/event-change-builders";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import { resolveItemRestAttempt } from "~/game/items/item-rest-engine";
import { isSuccessfulStatCheckOutcome, type StatCheckOutcome } from "~/game/events/event-outcomes";
import { resolveNaturalShelterCheck } from "./natural-shelter";
import {
  findAccessibleInventoryItem,
  getAccessibleInventoryItems,
  type AccessibleInventoryItem,
} from "~/game/items/inventory-engine";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import type { ItemTag } from "~/game/items/item-schema";
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
import type { NightRestQuality, SurvivalNeed } from "./survival-schema";
import {
  findCamouflagePreparationPlan,
  resolveCamouflagePreparationAttempt,
  type CamouflagePreparationPlan,
} from "./camouflage-preparation";

interface NightRestAttempt {
  outcome: StatCheckOutcome | null;
  changes: GameChange[];
}

export interface PreparedRound {
  state: GameState;
  events: ResolvedEvent[];
  committedItemInstanceIds: Set<string>;
}

type AutomaticItemPreparationMechanic = "hydration-consumption" | "food-consumption";

interface AutomaticItemPreparationAction {
  mechanic: AutomaticItemPreparationMechanic;

  requiredTag: ItemTag;
  affectedNeed?: SurvivalNeed;

  shouldPrepare: (tribute: GameTribute) => boolean;

  getAffectedStatusIds: (
    tribute: GameTribute,
    selection: AccessibleInventoryItem,
  ) => StatusEffectId[];
}

const HYDRATION_STATUS_IDS = ["thirsty", "dehydrated"] as const satisfies readonly StatusEffectId[];

const FOOD_STATUS_IDS = ["hungry", "starving"] as const satisfies readonly StatusEffectId[];

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

function hasAnyStatus(tribute: GameTribute, statusIds: readonly StatusEffectId[]): boolean {
  return tribute.statuses.some((status) => statusIds.includes(status.definitionId));
}

function getMatchingStatusIds(
  tribute: GameTribute,
  statusIds: readonly StatusEffectId[],
): StatusEffectId[] {
  return uniqueStatusIds(
    tribute.statuses.flatMap((status) =>
      statusIds.includes(status.definitionId) ? [status.definitionId] : [],
    ),
  );
}

const AUTOMATIC_ITEM_ACTIONS = [
  {
    mechanic: "hydration-consumption",

    requiredTag: "water",

    affectedNeed: "water",

    shouldPrepare: (tribute) => hasAnyStatus(tribute, HYDRATION_STATUS_IDS),

    getAffectedStatusIds: (tribute) => getMatchingStatusIds(tribute, HYDRATION_STATUS_IDS),
  },

  {
    mechanic: "food-consumption",

    requiredTag: "food",

    affectedNeed: "food",

    shouldPrepare: (tribute) => hasAnyStatus(tribute, FOOD_STATUS_IDS),

    getAffectedStatusIds: (tribute) => getMatchingStatusIds(tribute, FOOD_STATUS_IDS),
  },
] satisfies readonly AutomaticItemPreparationAction[];

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

function createAutomaticItemPreparationText(
  mechanic: AutomaticItemPreparationMechanic,
  actingTribute: GameTribute,
  selection: AccessibleInventoryItem,
): string {
  const itemPhrase = getItemPhrase(actingTribute, selection);

  switch (mechanic) {
    case "hydration-consumption":
      return (
        `${actingTribute.snapshot.name} drinks ` +
        `${itemPhrase} to recover from thirst ` +
        "and dehydration."
      );

    case "food-consumption":
      return `${actingTribute.snapshot.name} eats ` + `${itemPhrase} to recover from hunger.`;
  }
}

function createAutomaticItemPreparationEvent(
  state: GameState,
  round: RoundReference,
  action: AutomaticItemPreparationAction,
  actingTribute: GameTribute,
  selection: AccessibleInventoryItem,
): ResolvedEvent {
  const eventId = createPreparationEventId(round, action.mechanic, actingTribute.id);

  const affectedStatusIds = action.getAffectedStatusIds(actingTribute, selection);

  const changes = compileItemUseEffects({
    eventId,
    round,

    random: createPreparationRandom(state.seed, round, action.mechanic, actingTribute.id),

    actingTribute,
    owner: selection.owner,

    item: selection.item,

    reason: eventId,
  });

  return {
    id: eventId,
    definitionId: `automatic-${action.mechanic}`,

    kind: "preparation",
    resolutionMode: "standard",

    round,

    participantTributeIds: getEventParticipantIds(actingTribute, selection),

    text: createAutomaticItemPreparationText(action.mechanic, actingTribute, selection),

    changes,

    preparation: {
      mechanic: action.mechanic,

      actingTributeId: actingTribute.id,

      itemInstanceId: selection.item.id,

      itemDefinitionId: selection.item.definitionId,

      itemOwnerTributeId: selection.owner.id,

      usesRemainingAfter: getUsesRemainingAfter(selection),

      ...(action.affectedNeed
        ? {
            affectedNeed: action.affectedNeed,
          }
        : {}),

      ...(affectedStatusIds.length > 0
        ? {
            affectedStatusIds,
          }
        : {}),
    },
  };
}

function applyPreparationEvent(preparedRound: PreparedRound, event: ResolvedEvent): PreparedRound {
  const committedItemInstanceIds = new Set(preparedRound.committedItemInstanceIds);

  for (const itemInstanceId of getCommittedItemInstanceIds(event.changes)) {
    committedItemInstanceIds.add(itemInstanceId);
  }

  return {
    state: applyResolvedEvent(preparedRound.state, event),

    events: [...preparedRound.events, event],

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

function prepareAutomaticItemAction(
  preparedRound: PreparedRound,
  round: RoundReference,
  action: AutomaticItemPreparationAction,
): PreparedRound {
  let nextPreparedRound = preparedRound;

  const tributeIds = getStableLivingTributeIds(nextPreparedRound.state);

  for (const tributeId of tributeIds) {
    const actingTribute = requireLivingTribute(nextPreparedRound.state, tributeId);

    if (!action.shouldPrepare(actingTribute)) {
      continue;
    }

    const selection = findAccessibleInventoryItem(nextPreparedRound.state, actingTribute, {
      requiredTags: [action.requiredTag],

      unavailableItemInstanceIds: nextPreparedRound.committedItemInstanceIds,

      requireUsable: true,
    });

    if (!selection) {
      continue;
    }

    const event = createAutomaticItemPreparationEvent(
      nextPreparedRound.state,
      round,
      action,
      actingTribute,
      selection,
    );

    nextPreparedRound = applyPreparationEvent(nextPreparedRound, event);
  }

  return nextPreparedRound;
}

function getRestQualityRank(quality: NightRestQuality): number {
  switch (quality) {
    case "comfortable":
      return 2;

    case "sheltered":
      return 1;

    case "unsheltered":
      return 0;
  }
}

function compareRestSelections(
  actingTribute: GameTribute,
  first: AccessibleInventoryItem,
  second: AccessibleInventoryItem,
): number {
  const firstDefinition = getItemDefinition(first.item.definitionId);

  const secondDefinition = getItemDefinition(second.item.definitionId);

  const firstRest = firstDefinition.rest;

  const secondRest = secondDefinition.rest;

  if (!firstRest || !secondRest) {
    throw new Error("Rest selection contains an item without a rest capability.");
  }

  return (
    getRestQualityRank(secondRest.quality) - getRestQualityRank(firstRest.quality) ||
    Number(Boolean(firstRest.check)) - Number(Boolean(secondRest.check)) ||
    (firstRest.check?.difficulty ?? 0) - (secondRest.check?.difficulty ?? 0) ||
    Number(first.owner.id !== actingTribute.id) - Number(second.owner.id !== actingTribute.id) ||
    Number(first.item.usesRemaining !== null) - Number(second.item.usesRemaining !== null) ||
    firstDefinition.id.localeCompare(secondDefinition.id) ||
    first.item.id.localeCompare(second.item.id)
  );
}

function findBestAccessibleRestItem(
  state: GameState,
  tribute: GameTribute,
  committedItemInstanceIds: ReadonlySet<string>,
): AccessibleInventoryItem | null {
  return (
    getAccessibleInventoryItems(state, tribute, {
      unavailableItemInstanceIds: committedItemInstanceIds,

      requireUsable: true,
    })
      .filter((selection) => Boolean(getItemDefinition(selection.item.definitionId).rest))
      .sort((first, second) => compareRestSelections(tribute, first, second))[0] ?? null
  );
}

function getRecordedRestQuality(changes: readonly GameChange[]): NightRestQuality {
  const restChange = changes.find(
    (
      change,
    ): change is Extract<
      GameChange,
      {
        type: "record-night-rest";
      }
    > => change.type === "record-night-rest",
  );

  if (!restChange) {
    throw new Error("Night preparation did not record a rest result.");
  }

  return restChange.quality;
}

function createNaturalShelterRestAttempt(
  state: GameState,
  round: RoundReference,
  tribute: GameTribute,
): NightRestAttempt {
  const outcome = resolveNaturalShelterCheck(
    tribute,

    createPreparationRandom(state.seed, round, "night-rest-preparation", tribute.id),
  );

  const quality = isSuccessfulStatCheckOutcome(outcome) ? "sheltered" : "unsheltered";

  return {
    outcome,

    changes: [
      {
        type: "record-night-rest",

        tributeId: tribute.id,

        round: {
          ...round,
        },

        quality,
      },
    ],
  };
}

function createNightRestText(
  tribute: GameTribute,
  selection: AccessibleInventoryItem | null,
  quality: NightRestQuality,
  outcome: StatCheckOutcome | null,
): string {
  if (!selection) {
    if (quality === "sheltered") {
      return (
        `${tribute.snapshot.name} finds a protected ` +
        "natural hollow and prepares a sheltered place to sleep."
      );
    }

    return (
      `${tribute.snapshot.name} searches for natural shelter, ` +
      "but cannot find a safe place before nightfall."
    );
  }

  const itemPhrase = getItemPhrase(tribute, selection);

  if (quality === "unsheltered" && outcome === "critical-failure") {
    return (
      `${tribute.snapshot.name} tries to use ` +
      `${itemPhrase} to prepare camp, but burns ` +
      "themself and fails to establish shelter."
    );
  }

  if (quality === "unsheltered") {
    return (
      `${tribute.snapshot.name} tries to use ` +
      `${itemPhrase} to prepare camp, but the ` +
      "attempt fails and leaves them unsheltered."
    );
  }

  if (quality === "comfortable") {
    return (
      `${tribute.snapshot.name} settles in with ` + `${itemPhrase} for a comfortable night's rest.`
    );
  }

  return `${tribute.snapshot.name} uses ` + `${itemPhrase} to prepare a sheltered camp.`;
}

function createNightRestPreparationEvent(
  state: GameState,
  round: RoundReference,
  tribute: GameTribute,
  selection: AccessibleInventoryItem | null,
): ResolvedEvent {
  const eventId = createPreparationEventId(round, "night-rest-preparation", tribute.id);

  const attempt: NightRestAttempt = selection
    ? resolveItemRestAttempt({
        eventId,
        round,

        random: createPreparationRandom(state.seed, round, "night-rest-preparation", tribute.id),

        actingTribute: tribute,
        owner: selection.owner,
        item: selection.item,

        reason: eventId,
      })
    : createNaturalShelterRestAttempt(state, round, tribute);

  const restQuality = getRecordedRestQuality(attempt.changes);

  return {
    id: eventId,

    definitionId: "automatic-night-rest-preparation",

    kind: "preparation",
    resolutionMode: "standard",

    round,

    participantTributeIds: getEventParticipantIds(tribute, selection ?? undefined),

    text: createNightRestText(tribute, selection, restQuality, attempt.outcome),

    changes: attempt.changes,

    preparation: {
      mechanic: "night-rest-preparation",

      actingTributeId: tribute.id,

      restQuality,

      ...(selection
        ? {
            itemInstanceId: selection.item.id,

            itemDefinitionId: selection.item.definitionId,

            itemOwnerTributeId: selection.owner.id,

            usesRemainingAfter: getUsesRemainingAfter(selection),
          }
        : {}),
    },
  };
}

function prepareNightRest(preparedRound: PreparedRound, round: RoundReference): PreparedRound {
  let nextPreparedRound = preparedRound;

  const tributeIds = getStableLivingTributeIds(nextPreparedRound.state);

  for (const tributeId of tributeIds) {
    const tribute = requireLivingTribute(nextPreparedRound.state, tributeId);

    const selection = findBestAccessibleRestItem(
      nextPreparedRound.state,
      tribute,
      nextPreparedRound.committedItemInstanceIds,
    );

    const event = createNightRestPreparationEvent(
      nextPreparedRound.state,
      round,
      tribute,
      selection,
    );

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
      /*
       * Sheltered rest creates no new benefit
       * or penalty. Any benefit from an older
       * comfortable night is cleared.
       */
      return createRemoveStatusChanges(tribute, "well-rested");

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
      return hasWellRested ? ["well-rested"] : [];

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
      return `${tribute.snapshot.name} wakes after ` + "passing the night safely under shelter.";

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
    events: [],
    committedItemInstanceIds: new Set<string>(),
  };

  /*
   * Medical treatment occurs first so an
   * imminent fatality is handled before
   * ordinary food, hydration, or rest.
   */
  preparedRound = prepareMedicalTreatments(preparedRound, round);

  for (const action of AUTOMATIC_ITEM_ACTIONS) {
    preparedRound = prepareAutomaticItemAction(preparedRound, round, action);
  }

  if (round.period === "day") {
    preparedRound = prepareMorningRestResolution(preparedRound, round);
  } else {
    preparedRound = prepareNightRest(preparedRound, round);
  }

  return prepareCamouflage(preparedRound, round);
}
