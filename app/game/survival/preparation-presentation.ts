import { getItemDefinition } from "~/game/items/item-catalogue";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameTribute, PreparationMechanic, ResolvedEvent } from "~/game/types/game-state";

export type PreparationGroupId =
  "medical-care" | "food-and-hydration" | "rest-and-shelter" | "camouflage" | "other";

export type PreparationImpactTone = "positive" | "neutral" | "warning";

export interface PreparationEventPresentation {
  id: string;
  actingTributeName: string;
  text: string;

  itemLabel: string | null;
  borrowedFromLabel: string | null;
  remainingUsesLabel: string | null;

  impactDetails: readonly string[];
  impactTone: PreparationImpactTone;
}

export interface PreparationGroupPresentation {
  id: PreparationGroupId;
  label: string;
  description: string;
  events: readonly PreparationEventPresentation[];
}

interface PreparationGroupDefinition {
  label: string;
  description: string;
}

const PREPARATION_GROUP_ORDER = [
  "medical-care",
  "food-and-hydration",
  "rest-and-shelter",
  "camouflage",
  "other",
] as const satisfies readonly PreparationGroupId[];

const PREPARATION_GROUPS = {
  "medical-care": {
    label: "Medical care",
    description: "Treatments completed before arena events begin.",
  },

  "food-and-hydration": {
    label: "Food and hydration",
    description: "Automatic eating and drinking used to answer survival needs.",
  },

  "rest-and-shelter": {
    label: "Rest and shelter",
    description: "Night shelter attempts and their morning consequences.",
  },

  camouflage: {
    label: "Camouflage",
    description: "Concealment attempts completed before primary events.",
  },

  other: {
    label: "Other preparation",
    description: "Other automatic preparation completed before the round.",
  },
} satisfies Record<PreparationGroupId, PreparationGroupDefinition>;

const GROUP_BY_MECHANIC = {
  "medical-treatment": "medical-care",

  "hydration-consumption": "food-and-hydration",
  "food-consumption": "food-and-hydration",

  "night-rest-preparation": "rest-and-shelter",
  "morning-rest-resolution": "rest-and-shelter",

  "camouflage-preparation": "camouflage",
} satisfies Record<PreparationMechanic, Exclude<PreparationGroupId, "other">>;

function formatList(values: readonly string[]): string {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function getTributeName(tributes: readonly GameTribute[], tributeId: string): string {
  return tributes.find((tribute) => tribute.id === tributeId)?.snapshot.name ?? tributeId;
}

function getRemainingUsesLabel(usesRemaining: number | null | undefined): string | null {
  if (usesRemaining === undefined) {
    return null;
  }

  if (usesRemaining === null) {
    return "Reusable";
  }

  if (usesRemaining <= 0) {
    return "No uses remaining";
  }

  return `${usesRemaining} ${usesRemaining === 1 ? "use" : "uses"} remaining`;
}

function getStatusLabels(statusIds: readonly StatusEffectId[]): string[] {
  return statusIds.map((statusId) => getStatusDefinition(statusId).label);
}

function getAppliedStatusIds(event: ResolvedEvent): StatusEffectId[] {
  return [
    ...new Set(
      event.changes.flatMap((change) =>
        change.type === "apply-status" ? [change.status.definitionId] : [],
      ),
    ),
  ];
}

function createAppliedStatusDetails(
  event: ResolvedEvent,
  {
    beneficialPrefix = "Benefit gained",
    harmfulPrefix = "Condition applied",
  }: {
    beneficialPrefix?: string;
    harmfulPrefix?: string;
  } = {},
): string[] {
  const definitions = getAppliedStatusIds(event).map(getStatusDefinition);

  const beneficialLabels = definitions
    .filter((definition) => definition.kind === "beneficial")
    .map((definition) => definition.label);

  const harmfulLabels = definitions
    .filter((definition) => definition.kind === "harmful")
    .map((definition) => definition.label);

  return [
    ...(beneficialLabels.length > 0
      ? [`${beneficialPrefix}: ${formatList(beneficialLabels)}.`]
      : []),

    ...(harmfulLabels.length > 0 ? [`${harmfulPrefix}: ${formatList(harmfulLabels)}.`] : []),
  ];
}

function createMedicalImpactDetails(event: ResolvedEvent): string[] {
  const affectedStatusIds = event.preparation?.affectedStatusIds ?? [];

  if (affectedStatusIds.length === 0) {
    return ["Medical treatment completed."];
  }

  return [`Statuses treated: ${formatList(getStatusLabels(affectedStatusIds))}.`];
}

function createNeedImpactDetails(event: ResolvedEvent, needLabel: "Food" | "Hydration"): string[] {
  const affectedStatusIds = event.preparation?.affectedStatusIds ?? [];

  return [
    `Need restored: ${needLabel}.`,

    ...(affectedStatusIds.length > 0
      ? [`Statuses resolved: ${formatList(getStatusLabels(affectedStatusIds))}.`]
      : []),

    ...createAppliedStatusDetails(event, {
      beneficialPrefix: "Additional benefit",
      harmfulPrefix: "Additional consequence",
    }),
  ];
}

function createNightRestImpactDetails(event: ResolvedEvent): string[] {
  const restQuality = event.preparation?.restQuality;

  if (!restQuality) {
    return ["Night-rest preparation completed."];
  }

  const qualityLabel = {
    comfortable: "Comfortable rest",
    sheltered: "Sheltered rest",
    unsheltered: "Unsheltered",
  }[restQuality];

  return [
    `Rest result: ${qualityLabel}.`,

    ...createAppliedStatusDetails(event, {
      beneficialPrefix: "Additional benefit",
      harmfulPrefix: "Additional consequence",
    }),
  ];
}

function createMorningRestImpactDetails(event: ResolvedEvent): string[] {
  const restQuality = event.preparation?.restQuality;

  const result =
    restQuality === "comfortable"
      ? "Morning result: Rested comfortably."
      : restQuality === "sheltered"
        ? "Morning result: Rested safely under shelter."
        : restQuality === "unsheltered"
          ? "Morning result: Woke after an unsheltered night."
          : "Morning rest resolved.";

  return [
    result,

    ...createAppliedStatusDetails(event, {
      beneficialPrefix: "Status gained",
      harmfulPrefix: "Condition applied",
    }),
  ];
}

function createCamouflageImpactDetails(event: ResolvedEvent): string[] {
  const appliedStatusIds = getAppliedStatusIds(event);

  if (appliedStatusIds.length === 0) {
    return ["Camouflage result: No lasting concealment."];
  }

  const definitions = appliedStatusIds.map(getStatusDefinition);

  const beneficialLabels = definitions
    .filter((definition) => definition.kind === "beneficial")
    .map((definition) => definition.label);

  const harmfulLabels = definitions
    .filter((definition) => definition.kind === "harmful")
    .map((definition) => definition.label);

  return [
    ...(beneficialLabels.length > 0 ? [`Camouflage result: ${formatList(beneficialLabels)}.`] : []),

    ...(harmfulLabels.length > 0 ? [`Camouflage consequence: ${formatList(harmfulLabels)}.`] : []),
  ];
}

function createImpactDetails(event: ResolvedEvent): string[] {
  const mechanic = event.preparation?.mechanic;

  switch (mechanic) {
    case "medical-treatment":
      return createMedicalImpactDetails(event);

    case "hydration-consumption":
      return createNeedImpactDetails(event, "Hydration");

    case "food-consumption":
      return createNeedImpactDetails(event, "Food");

    case "night-rest-preparation":
      return createNightRestImpactDetails(event);

    case "morning-rest-resolution":
      return createMorningRestImpactDetails(event);

    case "camouflage-preparation":
      return createCamouflageImpactDetails(event);

    case undefined:
      return [];
  }
}

function getImpactTone(event: ResolvedEvent): PreparationImpactTone {
  const hasHarmfulAppliedStatus = getAppliedStatusIds(event).some(
    (statusId) => getStatusDefinition(statusId).kind === "harmful",
  );

  if (hasHarmfulAppliedStatus || event.preparation?.restQuality === "unsheltered") {
    return "warning";
  }

  switch (event.preparation?.mechanic) {
    case "medical-treatment":
    case "hydration-consumption":
    case "food-consumption":
      return "positive";

    case "night-rest-preparation":
      return "positive";

    case "morning-rest-resolution":
      return event.preparation.restQuality === "sheltered" ? "neutral" : "positive";

    case "camouflage-preparation":
      return getAppliedStatusIds(event).length > 0 ? "positive" : "neutral";

    case undefined:
      return "neutral";
  }
}

function getGroupId(event: ResolvedEvent): PreparationGroupId {
  const mechanic = event.preparation?.mechanic;

  return mechanic ? GROUP_BY_MECHANIC[mechanic] : "other";
}

function createEventPresentation(
  event: ResolvedEvent,
  tributes: readonly GameTribute[],
): PreparationEventPresentation {
  const details = event.preparation;

  const actingTributeId = details?.actingTributeId ?? event.participantTributeIds[0];

  const actingTributeName =
    actingTributeId === undefined ? "Preparation" : getTributeName(tributes, actingTributeId);

  const itemLabel =
    details?.itemDefinitionId === undefined
      ? null
      : getItemDefinition(details.itemDefinitionId).label;

  const isBorrowed =
    details?.itemOwnerTributeId !== undefined &&
    details.itemOwnerTributeId !== details.actingTributeId;

  const borrowedFromLabel =
    isBorrowed && details?.itemOwnerTributeId
      ? getTributeName(tributes, details.itemOwnerTributeId)
      : null;

  return {
    id: event.id,
    actingTributeName,
    text: event.text,

    itemLabel,

    borrowedFromLabel,

    remainingUsesLabel: getRemainingUsesLabel(details?.usesRemainingAfter),

    impactDetails: createImpactDetails(event),

    impactTone: getImpactTone(event),
  };
}

export function createPreparationFeedPresentation(
  events: readonly ResolvedEvent[],
  tributes: readonly GameTribute[],
): PreparationGroupPresentation[] {
  const eventsByGroup = new Map<PreparationGroupId, PreparationEventPresentation[]>();

  for (const event of events) {
    if (event.kind !== "preparation") {
      continue;
    }

    const groupId = getGroupId(event);

    const groupEvents = eventsByGroup.get(groupId) ?? [];

    groupEvents.push(createEventPresentation(event, tributes));

    eventsByGroup.set(groupId, groupEvents);
  }

  return PREPARATION_GROUP_ORDER.flatMap((groupId) => {
    const groupEvents = eventsByGroup.get(groupId);

    if (!groupEvents?.length) {
      return [];
    }

    return [
      {
        id: groupId,

        label: PREPARATION_GROUPS[groupId].label,

        description: PREPARATION_GROUPS[groupId].description,

        events: groupEvents,
      },
    ];
  });
}
