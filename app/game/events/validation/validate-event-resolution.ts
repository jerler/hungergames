import type { EventResolution } from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { getStatusDefinition } from "~/game/statuses/status-catalogue";
import type { RoundReference } from "~/game/types/game-state";

export interface EventResolutionValidationOptions {
  eventId: string;
  definitionId: string;
  round: RoundReference;
  resolution: EventResolution;
}

function roundsMatch(first: RoundReference, second: RoundReference): boolean {
  return first.day === second.day && first.period === second.period;
}

function requireNonEmpty(value: string, description: string): void {
  if (!value.trim()) {
    throw new Error(`${description} must be non-empty.`);
  }
}

export function validateEventResolution({
  eventId,
  definitionId,
  round,
  resolution,
}: EventResolutionValidationOptions): void {
  requireNonEmpty(resolution.text, `Event "${definitionId}" resolution text`);

  for (const change of resolution.changes) {
    switch (change.type) {
      case "set-survival-need-counter":
        if (!Number.isInteger(change.value) || change.value < 0) {
          throw new Error(
            `Event "${definitionId}" sets an invalid ${change.need} survival counter.`,
          );
        }

        break;

      case "increment-survival-need-counter":
        if (!Number.isInteger(change.amount) || change.amount <= 0) {
          throw new Error(
            `Event "${definitionId}" increments the ${change.need} survival counter by an invalid amount.`,
          );
        }

        break;

      case "satisfy-survival-need":
        break;

      case "record-night-rest":
        if (change.round.period !== "night") {
          throw new Error(`Event "${definitionId}" records rest outside a night round.`);
        }

        if (!roundsMatch(change.round, round)) {
          throw new Error(`Event "${definitionId}" records rest for the wrong round.`);
        }

        break;
      case "apply-status": {
        let definition;

        try {
          definition = getStatusDefinition(change.status.definitionId);
        } catch {
          throw new Error(
            `Event "${definitionId}" applies unknown status "${change.status.definitionId}".`,
          );
        }

        if (
          !Number.isInteger(change.status.severity) ||
          change.status.severity < 1 ||
          change.status.severity > definition.maxSeverity
        ) {
          throw new Error(
            `Event "${definitionId}" applies invalid severity ${change.status.severity} for status "${definition.id}".`,
          );
        }

        break;
      }

      case "acquire-item": {
        let definition;

        try {
          definition = getItemDefinition(change.item.definitionId);
        } catch {
          throw new Error(
            `Event "${definitionId}" acquires unknown item "${change.item.definitionId}".`,
          );
        }

        if (change.item.sourceEventId !== eventId) {
          throw new Error(
            `Event "${definitionId}" creates item "${change.item.id}" with source event "${change.item.sourceEventId}" instead of "${eventId}".`,
          );
        }

        if (!roundsMatch(change.item.acquiredRound, round)) {
          throw new Error(
            `Event "${definitionId}" creates item "${change.item.id}" with an incorrect acquisition round.`,
          );
        }

        switch (change.acquisitionSource) {
          case "natural-foraging":
            if (definition.origin !== "natural-resource") {
              throw new Error(
                `Event "${definitionId}" cannot acquire manufactured item "${definition.id}" through natural foraging.`,
              );
            }

            break;

          case "cornucopia":
            if (round.day !== 1 || round.period !== "day") {
              throw new Error(
                `Event "${definitionId}" cannot acquire Cornucopia items outside Day 1 daytime.`,
              );
            }

            break;

          case "sponsor":
            throw new Error(`Event "${definitionId}" uses unsupported sponsor acquisition.`);
        }

        break;
      }

      case "eliminate-tribute":
        requireNonEmpty(change.causeId, `Event "${definitionId}" fatality cause ID`);

        requireNonEmpty(change.causeLabel, `Event "${definitionId}" fatality cause label`);

        requireNonEmpty(change.summary, `Event "${definitionId}" fatality summary`);

        if (new Set(change.killerTributeIds).size !== change.killerTributeIds.length) {
          throw new Error(`Event "${definitionId}" contains duplicate killer IDs.`);
        }

        if (change.killerTributeIds.includes(change.tributeId)) {
          throw new Error(`Event "${definitionId}" cannot credit a tribute for killing themself.`);
        }

        break;

      case "use-item":
        requireNonEmpty(change.reason, `Event "${definitionId}" item-use reason`);

        break;

      case "consume-item":
        requireNonEmpty(change.reason, `Event "${definitionId}" item-consumption reason`);

        if (!Number.isInteger(change.uses) || change.uses <= 0) {
          throw new Error(`Event "${definitionId}" consumes an invalid number of item uses.`);
        }

        break;

      case "transfer-item":
        requireNonEmpty(change.reason, `Event "${definitionId}" transfer reason`);

        if (change.fromTributeId === change.toTributeId) {
          throw new Error(`Event "${definitionId}" cannot transfer an item to its current owner.`);
        }

        break;

      default:
        break;
    }
  }
}
