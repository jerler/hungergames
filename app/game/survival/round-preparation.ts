import { applyResolvedEvent } from "~/game/engine/apply-game-change";
import { createSeededRandom, type RandomSource } from "~/game/engine/random";
import { createStatusChange } from "~/game/events/event-change-builders";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { compileItemUseEffects } from "~/game/items/item-effect-engine";
import { compileItemRestChanges } from "~/game/items/item-rest-engine";
import {
  findAccessibleInventoryItem,
  getAccessibleInventoryItems,
  type AccessibleInventoryItem,
} from "~/game/items/inventory-engine";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import type { ItemTag } from "~/game/items/item-schema";
import { isMedicalStatusId } from "~/game/statuses/medical-statuses";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type {
  GameChange,
  GameState,
  GameTribute,
  PreparationMechanic,
  ResolvedEvent,
  RoundReference,
  StatusEffect,
} from "~/game/types/game-state";

import type { NightRestQuality, SurvivalNeed } from "./survival-schema";

export interface PreparedRound {
  state: GameState;
  events: ResolvedEvent[];
  committedItemInstanceIds: Set<string>;
}

type AutomaticItemPreparationMechanic =
  "urgent-medical-treatment" | "hydration-consumption" | "food-consumption";

interface AutomaticItemPreparationAction {
  mechanic: AutomaticItemPreparationMechanic;
  requiredTag: ItemTag;
  affectedNeed?: SurvivalNeed;

  shouldPrepare: (tribute: GameTribute) => boolean;

  getAffectedStatusIds: (tribute: GameTribute) => StatusEffectId[];
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

function isUrgentMedicalStatus(status: StatusEffect): boolean {
  if (!isMedicalStatusId(status.definitionId) || status.remainingRounds === null) {
    return false;
  }

  const definition = getStatusDefinition(status.definitionId);

  return (
    definition.duration.kind === "timed" &&
    definition.duration.expiration === "fatal" &&
    status.remainingRounds <= 1
  );
}

function getMedicalStatusIds(tribute: GameTribute): StatusEffectId[] {
  return uniqueStatusIds(
    tribute.statuses.flatMap((status) =>
      isMedicalStatusId(status.definitionId) ? [status.definitionId] : [],
    ),
  );
}

const AUTOMATIC_ITEM_ACTIONS = [
  {
    mechanic: "urgent-medical-treatment",
    requiredTag: "medicine",

    shouldPrepare: (tribute) => tribute.statuses.some(isUrgentMedicalStatus),

    getAffectedStatusIds: getMedicalStatusIds,
  },

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

function createAutomaticItemPreparationText(
  mechanic: AutomaticItemPreparationMechanic,
  actingTribute: GameTribute,
  selection: AccessibleInventoryItem,
): string {
  const itemPhrase = getItemPhrase(actingTribute, selection);

  switch (mechanic) {
    case "urgent-medical-treatment":
      return (
        `${actingTribute.snapshot.name} uses ` +
        `${itemPhrase} to treat an urgent ` +
        "medical condition."
      );

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
  round: RoundReference,
  action: AutomaticItemPreparationAction,
  actingTribute: GameTribute,
  selection: AccessibleInventoryItem,
): ResolvedEvent {
  const eventId = createPreparationEventId(round, action.mechanic, actingTribute.id);

  const affectedStatusIds = action.getAffectedStatusIds(actingTribute);

  const changes = compileItemUseEffects({
    eventId,
    round,

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

    const event = createAutomaticItemPreparationEvent(round, action, actingTribute, selection);

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
    Number(first.owner.id !== actingTribute.id) - Number(second.owner.id !== actingTribute.id) ||
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

function createNightRestText(
  tribute: GameTribute,
  selection: AccessibleInventoryItem | null,
  quality: NightRestQuality,
): string {
  if (!selection) {
    return `${tribute.snapshot.name} finds no ` + "shelter and settles in for an exposed night.";
  }

  const itemPhrase = getItemPhrase(tribute, selection);

  if (quality === "unsheltered") {
    return (
      `${tribute.snapshot.name} tries to use ` +
      `${itemPhrase} to prepare camp, but the ` +
      "attempt fails and leaves them exposed."
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

  const changes: GameChange[] = selection
    ? compileItemRestChanges({
        eventId,
        round,

        random: createPreparationRandom(state.seed, round, "night-rest-preparation", tribute.id),

        actingTribute: tribute,
        owner: selection.owner,
        item: selection.item,

        reason: eventId,
      })
    : [
        {
          type: "record-night-rest",
          tributeId: tribute.id,
          round: {
            ...round,
          },
          quality: "unsheltered",
        },
      ];

  const restQuality = getRecordedRestQuality(changes);

  return {
    id: eventId,
    definitionId: "automatic-night-rest-preparation",

    kind: "preparation",
    resolutionMode: "standard",

    round,

    participantTributeIds: getEventParticipantIds(tribute, selection ?? undefined),

    text: createNightRestText(tribute, selection, restQuality),

    changes,

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
  if (quality === "unsheltered") {
    return [
      ...createRemoveStatusChanges(tribute, "well-rested"),

      createStatusChange(eventId, tribute, "exhausted", 1, round),
    ];
  }

  const wellRestedSeverity = quality === "comfortable" ? 2 : 1;

  return [
    ...createRemoveStatusChanges(tribute, "exhausted"),

    /*
     * Replace yesterday's benefit rather than
     * allowing consecutive nights to stack it.
     */
    ...createRemoveStatusChanges(tribute, "well-rested"),

    createStatusChange(eventId, tribute, "well-rested", wellRestedSeverity, round),
  ];
}

function getMorningAffectedStatusIds(
  tribute: GameTribute,
  quality: NightRestQuality,
): StatusEffectId[] {
  if (quality === "unsheltered") {
    return uniqueStatusIds([
      ...(getStatusInstanceIds(tribute, "well-rested").length > 0 ? ["well-rested" as const] : []),

      "exhausted",
    ]);
  }

  return uniqueStatusIds([
    ...(getStatusInstanceIds(tribute, "exhausted").length > 0 ? ["exhausted" as const] : []),

    "well-rested",
  ]);
}

function createMorningRestText(tribute: GameTribute, quality: NightRestQuality): string {
  switch (quality) {
    case "comfortable":
      return (
        `${tribute.snapshot.name} wakes fully restored ` + "after a comfortable night's sleep."
      );

    case "sheltered":
      return `${tribute.snapshot.name} wakes rested after ` + "sleeping safely under shelter.";

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

  for (const action of AUTOMATIC_ITEM_ACTIONS) {
    preparedRound = prepareAutomaticItemAction(preparedRound, round, action);
  }

  if (round.period === "day") {
    return prepareMorningRestResolution(preparedRound, round);
  }

  return prepareNightRest(preparedRound, round);
}
