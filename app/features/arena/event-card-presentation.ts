import { EVENT_CATALOGUE } from "~/game/events/catalogue";
import { BLOODBATH_EVENT_CATALOGUE } from "~/game/events/catalogue/bloodbath";
import { getItemDefinition } from "~/game/items/item-catalogue";
import type { ItemAcquisitionSource, ItemDefinitionId } from "~/game/items/item-schema";
import {
  createStatusPresentation,
  type StatusPresentationTone,
} from "~/game/statuses/status-presentation";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { GameChange, GameTribute, ResolvedEvent } from "~/game/types/game-state";

export type EventVisualKind =
  | "combat"
  | "accidental-death"
  | "survival"
  | "hazard"
  | "relationship"
  | "theft"
  | "inventory"
  | "status"
  | "special";

export const EVENT_VISUAL_PRESENTATIONS = {
  combat: {
    label: "Combat",
  },
  "accidental-death": {
    label: "Accidental death",
  },
  survival: {
    label: "Survival",
  },
  hazard: {
    label: "Arena hazard",
  },
  relationship: {
    label: "Relationship",
  },
  theft: {
    label: "Theft",
  },
  inventory: {
    label: "Supplies",
  },
  status: {
    label: "Status",
  },
  special: {
    label: "Arena event",
  },
} satisfies Record<EventVisualKind, { label: string }>;

export interface EventDeathPresentation {
  key: string;
  tribute: GameTribute | null;
  tributeName: string;
  causeLabel: string;
  summary: string;
  killerNames: readonly string[];
}

export interface EventStatusChangePresentation {
  key: string;
  tribute: GameTribute | null;
  tributeName: string;
  label: string;
  meta: string;
  description: string;
  tone: StatusPresentationTone;
  action: "applied" | "removed";
}

export interface EventItemAcquisitionPresentation {
  key: string;
  kind: "acquired";
  tribute: GameTribute | null;
  tributeName: string;
  itemLabel: string;
  sourceLabel: string;
}

export interface EventItemTransferPresentation {
  key: string;
  kind: "transferred" | "stolen";
  fromTribute: GameTribute | null;
  fromTributeName: string;
  toTribute: GameTribute | null;
  toTributeName: string;
  itemLabel: string;
}

export type EventItemChangePresentation =
  EventItemAcquisitionPresentation | EventItemTransferPresentation;

export interface EventCardPresentation {
  visualKind: EventVisualKind;
  visualLabel: string;
  primaryTribute: GameTribute | null;
  primaryTributeName: string | null;
  deaths: readonly EventDeathPresentation[];
  statusChanges: readonly EventStatusChangePresentation[];
  itemChanges: readonly EventItemChangePresentation[];
}

const EVENT_DEFINITION_BY_ID = new Map(
  [...EVENT_CATALOGUE, ...BLOODBATH_EVENT_CATALOGUE].map((definition) => [
    definition.id,
    definition,
  ]),
);

function getInstanceDefinitionId(instanceId: string): string | null {
  return instanceId.split(":").at(-1) ?? null;
}

function getItemLabelFromInstanceId(itemInstanceId: string): string {
  const definitionId = getInstanceDefinitionId(itemInstanceId);

  if (!definitionId) {
    return "Unknown item";
  }

  try {
    return getItemDefinition(definitionId as ItemDefinitionId).label;
  } catch {
    return "Unknown item";
  }
}

function getStatusLabelFromInstanceId(statusInstanceId: string): string {
  const definitionId = getInstanceDefinitionId(statusInstanceId);

  if (!definitionId) {
    return "Status";
  }

  try {
    return getStatusDefinition(definitionId as StatusEffectId).label;
  } catch {
    return "Status";
  }
}

function formatAcquisitionSource(source: ItemAcquisitionSource): string {
  switch (source) {
    case "cornucopia":
      return "Cornucopia";
    case "natural-foraging":
      return "Foraged";
    case "crafted":
      return "Crafted";
    case "sponsor":
      return "Sponsor gift";
  }
}

function getFirstChangedTributeId(changes: readonly GameChange[]): string | null {
  for (const change of changes) {
    if ("tributeId" in change) {
      return change.tributeId;
    }

    if (change.type === "transfer-item") {
      return change.toTributeId;
    }

    if (change.type === "form-truce") {
      return change.truce.tributeIds[0] ?? null;
    }

    if (change.type === "form-vendetta") {
      return change.vendetta.hunterTributeId;
    }

    if (change.type === "declare-victory") {
      return change.outcome.victorTributeIds[0] ?? null;
    }
  }

  return null;
}

function getParticipantOrder(event: ResolvedEvent): ReadonlyMap<string, number> {
  return new Map(
    event.participantTributeIds.map((tributeId, index) => [tributeId, index] as const),
  );
}

function getMostCreditedKillerId(
  event: ResolvedEvent,
  tributeById: ReadonlyMap<string, GameTribute>,
): string | null {
  const killCounts = new Map<string, number>();

  for (const change of event.changes) {
    if (change.type !== "eliminate-tribute") {
      continue;
    }

    for (const killerTributeId of change.killerTributeIds) {
      if (!tributeById.has(killerTributeId)) {
        continue;
      }

      killCounts.set(killerTributeId, (killCounts.get(killerTributeId) ?? 0) + 1);
    }
  }

  if (killCounts.size === 0) {
    return null;
  }

  const participantOrder = getParticipantOrder(event);

  return (
    [...killCounts.entries()].sort(
      ([firstId, firstCount], [secondId, secondCount]) =>
        secondCount - firstCount ||
        (participantOrder.get(firstId) ?? Number.MAX_SAFE_INTEGER) -
          (participantOrder.get(secondId) ?? Number.MAX_SAFE_INTEGER) ||
        firstId.localeCompare(secondId),
    )[0]?.[0] ?? null
  );
}

function getPrimaryTributeId(
  event: ResolvedEvent,
  tributeById: ReadonlyMap<string, GameTribute>,
): string | null {
  /*
   * The first selected participant is not always the narrative focus.
   *
   * Bloodbath contests, for example, select contenders first and choose
   * the eventual winner during resolution. Prefer concrete outcome data
   * before falling back to role/participant order.
   */
  for (const change of event.changes) {
    if (change.type !== "declare-victory") {
      continue;
    }

    const victorTributeId = change.outcome.victorTributeIds.find((tributeId) =>
      tributeById.has(tributeId),
    );

    if (victorTributeId) {
      return victorTributeId;
    }
  }

  const creditedKillerId = getMostCreditedKillerId(event, tributeById);

  if (creditedKillerId) {
    return creditedKillerId;
  }

  const theftRecipientId = event.changes.find(
    (change) =>
      change.type === "transfer-item" &&
      change.reason === "theft" &&
      tributeById.has(change.toTributeId),
  );

  if (theftRecipientId && theftRecipientId.type === "transfer-item") {
    return theftRecipientId.toTributeId;
  }

  const acquisitionRecipientId = event.changes.find(
    (change) => change.type === "acquire-item" && tributeById.has(change.tributeId),
  );

  if (acquisitionRecipientId && acquisitionRecipientId.type === "acquire-item") {
    return acquisitionRecipientId.tributeId;
  }

  const transferRecipientId = event.changes.find(
    (change) => change.type === "transfer-item" && tributeById.has(change.toTributeId),
  );

  if (transferRecipientId && transferRecipientId.type === "transfer-item") {
    return transferRecipientId.toTributeId;
  }

  return (
    event.participantTributeIds.find((tributeId) => tributeById.has(tributeId)) ??
    getFirstChangedTributeId(event.changes)
  );
}

function getEventVisualKind(event: ResolvedEvent): EventVisualKind {
  const definition = EVENT_DEFINITION_BY_ID.get(event.definitionId);

  const tags = new Set<string>(definition?.tags ?? []);

  const eliminationChanges = event.changes.filter(
    (
      change,
    ): change is Extract<
      GameChange,
      {
        type: "eliminate-tribute";
      }
    > => change.type === "eliminate-tribute",
  );

  /*
   * Death is the strongest visible outcome.
   *
   * A credited killer is concrete evidence of combat.
   * Explicit combat or ambush authoring tags cover
   * combat deaths where attribution is intentionally
   * omitted from the resolved change.
   *
   * A generic "fatal" or "weapon" tag is not enough:
   * weapons can misfire and fatal hazards can be wholly
   * environmental.
   */
  if (eliminationChanges.length > 0) {
    const hasCreditedKiller = eliminationChanges.some(
      (change) => change.killerTributeIds.length > 0,
    );

    const isExplicitCombat = tags.has("combat") || tags.has("ambush");

    return hasCreditedKiller || isExplicitCombat ? "combat" : "accidental-death";
  }

  /*
   * Status is the next strongest outcome. This is based
   * on an actual applied or removed status rather than a
   * loose catalogue tag.
   */
  const hasStatusChange = event.changes.some(
    (change) => change.type === "apply-status" || change.type === "remove-status",
  );

  if (hasStatusChange) {
    return "status";
  }

  /*
   * Everything else is part of the arena's general
   * activity: survival moments, item changes, theft,
   * relationships, preparation, and flavour events.
   */
  return "hazard";
}

export function createEventCardPresentation(
  event: ResolvedEvent,
  tributes: readonly GameTribute[],
): EventCardPresentation {
  const tributeById = new Map(tributes.map((tribute) => [tribute.id, tribute] as const));

  const primaryTributeId = getPrimaryTributeId(event, tributeById);

  const primaryTribute = primaryTributeId ? (tributeById.get(primaryTributeId) ?? null) : null;

  const deaths: EventDeathPresentation[] = [];
  const statusChanges: EventStatusChangePresentation[] = [];
  const itemChanges: EventItemChangePresentation[] = [];

  const eliminatedTributeIds = new Set(
    event.changes
      .filter(
        (change): change is Extract<GameChange, { type: "eliminate-tribute" }> =>
          change.type === "eliminate-tribute",
      )
      .map((change) => change.tributeId),
  );

  for (const change of event.changes) {
    switch (change.type) {
      case "eliminate-tribute": {
        const tribute = tributeById.get(change.tributeId) ?? null;
        const killerNames = change.killerTributeIds
          .map((killerTributeId) => tributeById.get(killerTributeId)?.snapshot.name)
          .filter((name): name is string => name !== undefined);

        deaths.push({
          key: `${event.id}:death:${change.tributeId}`,
          tribute,
          tributeName: tribute?.snapshot.name ?? "Unknown tribute",
          causeLabel: change.causeLabel,
          summary: change.summary,
          killerNames,
        });
        break;
      }

      case "apply-status": {
        if (eliminatedTributeIds.has(change.tributeId)) {
          break;
        }

        const tribute = tributeById.get(change.tributeId) ?? null;
        const sourceTributeName = change.status.sourceTributeId
          ? (tributeById.get(change.status.sourceTributeId)?.snapshot.name ?? null)
          : null;

        const details = createStatusPresentation(change.status, {
          sourceTributeName,
        });

        statusChanges.push({
          key: `${event.id}:status-applied:${change.status.id}`,
          tribute,
          tributeName: tribute?.snapshot.name ?? "Unknown tribute",
          label: details.label,
          meta: `${details.severityLabel} · ${details.durationLabel}`,
          description: details.lifecycleSummary,
          tone: details.tone,
          action: "applied",
        });
        break;
      }

      case "remove-status": {
        if (eliminatedTributeIds.has(change.tributeId)) {
          break;
        }

        const tribute = tributeById.get(change.tributeId) ?? null;

        statusChanges.push({
          key: `${event.id}:status-removed:${change.statusId}`,
          tribute,
          tributeName: tribute?.snapshot.name ?? "Unknown tribute",
          label: getStatusLabelFromInstanceId(change.statusId),
          meta: "Recovered",
          description: "This status was removed during the event.",
          tone: "beneficial",
          action: "removed",
        });
        break;
      }

      case "acquire-item": {
        const tribute = tributeById.get(change.tributeId) ?? null;

        itemChanges.push({
          key: `${event.id}:item-acquired:${change.item.id}`,
          kind: "acquired",
          tribute,
          tributeName: tribute?.snapshot.name ?? "Unknown tribute",
          itemLabel: getItemDefinition(change.item.definitionId).label,
          sourceLabel: formatAcquisitionSource(change.acquisitionSource),
        });
        break;
      }

      case "transfer-item": {
        const fromTribute = tributeById.get(change.fromTributeId) ?? null;
        const toTribute = tributeById.get(change.toTributeId) ?? null;

        itemChanges.push({
          key: `${event.id}:item-transferred:${change.itemInstanceId}`,
          kind: change.reason === "theft" ? "stolen" : "transferred",
          fromTribute,
          fromTributeName: fromTribute?.snapshot.name ?? "Unknown previous owner",
          toTribute,
          toTributeName: toTribute?.snapshot.name ?? "Unknown new owner",
          itemLabel: getItemLabelFromInstanceId(change.itemInstanceId),
        });
        break;
      }

      default:
        break;
    }
  }

  const visualKind = getEventVisualKind(event);

  return {
    visualKind,
    visualLabel: EVENT_VISUAL_PRESENTATIONS[visualKind].label,
    primaryTribute,
    primaryTributeName:
      primaryTribute?.snapshot.name ?? (primaryTributeId ? "Unknown tribute" : null),
    deaths,
    statusChanges,
    itemChanges,
  };
}
