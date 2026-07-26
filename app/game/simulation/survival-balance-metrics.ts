import {
  FOOD_THEFT_EVENTS,
  WATER_THEFT_EVENTS,
} from "~/game/events/catalogue/encounters/resource-theft-events";
import { isEligibleForDeprivationStatusEvent } from "~/game/survival/survival-history";
import { isLegacyFoodWaterItemId } from "~/game/survival/survival-resource-schema";
import type { GameState, GameTribute, ResolvedEvent } from "~/game/types/game-state";
import type { StatusEffectId } from "~/game/statuses/status-schema";

import type { SimulationRun, SimulationRoundSnapshot } from "./simulation-runner";

const FOOD_THEFT_EVENT_IDS = new Set(FOOD_THEFT_EVENTS.map((event) => event.id));

const WATER_THEFT_EVENT_IDS = new Set(WATER_THEFT_EVENTS.map((event) => event.id));

export interface SurvivalBalanceMetrics {
  foodSatisfactionEvents: number;
  waterSatisfactionEvents: number;

  hungerEligibilityOpportunities: number;
  thirstEligibilityOpportunities: number;

  hungryApplications: number;
  thirstyApplications: number;

  hungerResolutions: number;
  thirstResolutions: number;

  foodTheftAttempts: number;
  foodTheftSuccesses: number;
  waterTheftAttempts: number;
  waterTheftSuccesses: number;

  prematureHungerApplications: number;
  prematureThirstApplications: number;

  deprivationPrimaryEvents: number;
  primaryEvents: number;
  deprivationPrimaryEventRate: number;

  legacyFoodWaterAcquisitions: number;
  automaticDeprivationFatalities: number;
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function hasStatus(tribute: GameTribute | undefined, statusId: StatusEffectId): boolean {
  return (
    tribute?.statuses.some(
      (status) =>
        status.definitionId === statusId &&
        (status.remainingRounds === null || status.remainingRounds > 0),
    ) ?? false
  );
}

function getTribute(state: GameState, tributeId: string): GameTribute | undefined {
  return state.tributes.find((tribute) => tribute.id === tributeId);
}

function getSnapshotKey(snapshot: SimulationRoundSnapshot): string {
  return [snapshot.round.day, snapshot.round.period].join(":");
}

function getEventKey(event: ResolvedEvent): string {
  return [event.round.day, event.round.period].join(":");
}

type ApplyStatusChange = Extract<
  ResolvedEvent["changes"][number],
  {
    type: "apply-status";
  }
>;

function getAppliedStatusChanges(event: ResolvedEvent): ApplyStatusChange[] {
  return event.changes.filter(
    (change): change is ApplyStatusChange => change.type === "apply-status",
  );
}

function countStatusResolutions(run: SimulationRun, statusId: StatusEffectId): number {
  const states = [...run.roundSnapshots.map((snapshot) => snapshot.state), run.state];

  let resolutions = 0;

  for (let stateIndex = 1; stateIndex < states.length; stateIndex += 1) {
    const previousState = states[stateIndex - 1];
    const currentState = states[stateIndex];

    if (!previousState || !currentState) {
      continue;
    }

    for (const previousTribute of previousState.tributes) {
      const currentTribute = getTribute(currentState, previousTribute.id);

      if (
        hasStatus(previousTribute, statusId) &&
        currentTribute?.isAlive &&
        !hasStatus(currentTribute, statusId)
      ) {
        resolutions += 1;
      }
    }
  }

  return resolutions;
}

function isDeprivationFatality(event: ResolvedEvent): boolean {
  return event.changes.some(
    (change) =>
      change.type === "eliminate-tribute" &&
      /starv|dehydrat/i.test([change.causeId, change.causeLabel].join(" ")),
  );
}

export function collectSurvivalBalanceMetrics(
  runs: readonly SimulationRun[],
): SurvivalBalanceMetrics {
  let foodSatisfactionEvents = 0;
  let waterSatisfactionEvents = 0;

  let hungerEligibilityOpportunities = 0;
  let thirstEligibilityOpportunities = 0;

  let hungryApplications = 0;
  let thirstyApplications = 0;

  let hungerResolutions = 0;
  let thirstResolutions = 0;

  let foodTheftAttempts = 0;
  let foodTheftSuccesses = 0;
  let waterTheftAttempts = 0;
  let waterTheftSuccesses = 0;

  let prematureHungerApplications = 0;
  let prematureThirstApplications = 0;

  let deprivationPrimaryEvents = 0;
  let primaryEvents = 0;

  let legacyFoodWaterAcquisitions = 0;
  let automaticDeprivationFatalities = 0;

  for (const run of runs) {
    const snapshotByRound = new Map(
      run.roundSnapshots.map((snapshot) => [getSnapshotKey(snapshot), snapshot]),
    );

    for (const snapshot of run.roundSnapshots) {
      for (const tribute of snapshot.state.tributes) {
        if (isEligibleForDeprivationStatusEvent(snapshot.round, tribute, "food")) {
          hungerEligibilityOpportunities += 1;
        }

        if (isEligibleForDeprivationStatusEvent(snapshot.round, tribute, "water")) {
          thirstEligibilityOpportunities += 1;
        }
      }
    }

    hungerResolutions += countStatusResolutions(run, "hungry");
    thirstResolutions += countStatusResolutions(run, "thirsty");

    for (const event of run.state.eventHistory) {
      if (event.kind === "primary") {
        primaryEvents += 1;

        if (event.definitionId === "becomes-hungry" || event.definitionId === "becomes-thirsty") {
          deprivationPrimaryEvents += 1;
        }
      }

      if (isDeprivationFatality(event)) {
        automaticDeprivationFatalities += 1;
      }

      const satisfiedNeeds = event.changes.flatMap((change) =>
        change.type === "satisfy-survival-need" ? [change] : [],
      );

      if (satisfiedNeeds.some((change) => change.need === "food")) {
        foodSatisfactionEvents += 1;
      }

      if (satisfiedNeeds.some((change) => change.need === "water")) {
        waterSatisfactionEvents += 1;
      }

      if (FOOD_THEFT_EVENT_IDS.has(event.definitionId)) {
        foodTheftAttempts += 1;

        if (satisfiedNeeds.some((change) => change.need === "food")) {
          foodTheftSuccesses += 1;
        }
      }

      if (WATER_THEFT_EVENT_IDS.has(event.definitionId)) {
        waterTheftAttempts += 1;

        if (satisfiedNeeds.some((change) => change.need === "water")) {
          waterTheftSuccesses += 1;
        }
      }

      const snapshot = snapshotByRound.get(getEventKey(event));

      for (const change of getAppliedStatusChanges(event)) {
        const { status } = change;

        if (status.definitionId === "hungry") {
          hungryApplications += 1;

          const tribute = snapshot ? getTribute(snapshot.state, change.tributeId) : undefined;

          if (!tribute || !isEligibleForDeprivationStatusEvent(event.round, tribute, "food")) {
            prematureHungerApplications += 1;
          }
        }

        if (status.definitionId === "thirsty") {
          thirstyApplications += 1;

          const tribute = snapshot ? getTribute(snapshot.state, change.tributeId) : undefined;

          if (!tribute || !isEligibleForDeprivationStatusEvent(event.round, tribute, "water")) {
            prematureThirstApplications += 1;
          }
        }
      }
    }

    for (const transaction of run.state.itemTransactions) {
      if (transaction.type === "acquired" && isLegacyFoodWaterItemId(transaction.definitionId)) {
        legacyFoodWaterAcquisitions += 1;
      }
    }
  }

  return {
    foodSatisfactionEvents,
    waterSatisfactionEvents,

    hungerEligibilityOpportunities,
    thirstEligibilityOpportunities,

    hungryApplications,
    thirstyApplications,

    hungerResolutions,
    thirstResolutions,

    foodTheftAttempts,
    foodTheftSuccesses,
    waterTheftAttempts,
    waterTheftSuccesses,

    prematureHungerApplications,
    prematureThirstApplications,

    deprivationPrimaryEvents,
    primaryEvents,
    deprivationPrimaryEventRate: divide(deprivationPrimaryEvents, primaryEvents),

    legacyFoodWaterAcquisitions,
    automaticDeprivationFatalities,
  };
}
