import { BLOODBATH_EVENT_CATALOGUE } from "~/game/events/catalogue/bloodbath";

import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";

import { COMBAT_EVENTS } from "~/game/events/catalogue/encounters/combat-events";

import { TACTICAL_EVENTS } from "~/game/events/catalogue/encounters/tactical-events";

import { ITEM_CATALOGUE, getItemDefinition } from "~/game/items/item-catalogue";

import { STATUS_CATALOGUE, getStatusDefinition } from "~/game/statuses/status-catalogue";

import type { PreparationMechanic, ResolvedEvent } from "~/game/types/game-state";

import type { TributeStats } from "~/game/types/tribute";

import type { SimulationRun } from "./simulation-runner";

type NumericTributeStats = Record<keyof TributeStats, number>;

export type GameSizeMetricId = "half-game" | "full-game";

export interface NumberDistribution {
  minimum: number;
  average: number;
  median: number;
  percentile90: number;
  maximum: number;
}

export interface GameSizeBalanceMetrics {
  games: number;
  completionRate: number;

  rounds: NumberDistribution;

  averagePrimaryEvents: number;
  averageEliminations: number;
}

export interface EventFamilyBalanceMetric {
  id: string;
  label: string;

  eventCount: number;
  gamesWithEvent: number;
  eventsPerGame: number;
}

export interface StatValueBalanceMetric {
  value: number;
  appearances: number;
  victories: number;
  victoryRate: number;
}

export interface BalanceMetrics {
  sample: {
    totalGames: number;
    halfGames: number;
    fullGames: number;
  };

  gameSizes: Record<GameSizeMetricId, GameSizeBalanceMetrics>;

  victories: {
    sole: number;
    joint: number;
    soleRate: number;
    jointRate: number;
  };

  eliminations: {
    total: number;
    dayOne: number;
    dayOneShare: number;

    bySource: Record<string, number>;
  };

  combat: {
    directAttempts: number;
    directSuccesses: number;
    directFailures: number;
    directSuccessRate: number;

    tacticalAttempts: number;
    tacticalConnections: number;
    tacticalConnectionRate: number;

    lowBrawnTacticalAttempts: number;

    delayedAttributedFatalities: number;
    safetyResolutions: number;
  };

  preparation: {
    totalEvents: number;

    byMechanic: Record<PreparationMechanic, number>;

    borrowedItemEvents: number;

    restQuality: {
      comfortable: number;
      sheltered: number;
      unsheltered: number;
    };

    camouflage: {
      successful: number;
      unsuccessful: number;
      harmfulFailure: number;
    };
  };

  statuses: {
    totalApplications: number;

    applicationsByStatus: Record<string, number>;

    fatalitiesByStatus: Record<string, number>;
  };

  inventory: {
    totalAcquisitions: number;
    totalConsumedUses: number;
    totalTransfers: number;

    averageAcquisitionsPerGame: number;
    averageConsumedUsesPerGame: number;
    averageTransfersPerGame: number;

    acquisitionSources: Record<string, number>;

    transferSources: Record<string, number>;

    acquisitionsByItem: Record<string, number>;

    consumedUsesByItem: Record<string, number>;

    distinctItemsAcquired: number;
    neverAcquiredItemIds: readonly string[];
  };

  eventFamilies: readonly EventFamilyBalanceMetric[];

  victorStats: {
    average: NumericTributeStats;

    byValue: Record<keyof TributeStats, readonly StatValueBalanceMetric[]>;
  };
}

interface ActiveEventFamily {
  id: string;
  label: string;
  eventIds: ReadonlySet<string>;
}

const DIRECT_COMBAT_EVENT_IDS = new Set(COMBAT_EVENTS.map((event) => event.id));

const TACTICAL_EVENT_IDS = new Set(TACTICAL_EVENTS.map((event) => event.id));

const BLOODBATH_EVENT_IDS = new Set(BLOODBATH_EVENT_CATALOGUE.map((event) => event.id));

const ACTIVE_EVENT_FAMILIES: readonly ActiveEventFamily[] = [
  ...ORDINARY_EVENT_CATALOGUE_FAMILIES.map((family) => ({
    id: `ordinary:${family.name}`,

    label: family.name,

    eventIds: new Set(family.events.map((event) => event.id)),
  })),

  ...BLOODBATH_EVENT_CATALOGUE_FAMILIES.map((family) => ({
    id: `bloodbath:${family.name}`,

    label: `Bloodbath — ${family.name}`,

    eventIds: new Set(family.events.map((event) => event.id)),
  })),
].filter((family) => family.eventIds.size > 0);

const PREPARATION_MECHANICS = [
  "medical-treatment",
  "night-rest-preparation",
  "morning-rest-resolution",
  "camouflage-preparation",
] as const satisfies readonly PreparationMechanic[];

const STAT_KEYS = ["brains", "brawn", "luck"] as const satisfies readonly (keyof TributeStats)[];

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function getAverage(values: readonly number[]): number {
  return divide(
    values.reduce(
      (total, value) => total + value,

      0,
    ),

    values.length,
  );
}

function getPercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => first - second);

  const index = Math.min(
    sorted.length - 1,

    Math.ceil(percentile * sorted.length) - 1,
  );

  return sorted[index] ?? 0;
}

function createDistribution(values: readonly number[]): NumberDistribution {
  if (values.length === 0) {
    return {
      minimum: 0,
      average: 0,
      median: 0,
      percentile90: 0,
      maximum: 0,
    };
  }

  return {
    minimum: Math.min(...values),

    average: getAverage(values),

    median: getPercentile(values, 0.5),

    percentile90: getPercentile(values, 0.9),

    maximum: Math.max(...values),
  };
}

function createCountRecord(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function incrementCount(counts: Record<string, number>, key: string, amount = 1): void {
  counts[key] = (counts[key] ?? 0) + amount;
}

function getPrimaryEvents(run: SimulationRun): ResolvedEvent[] {
  return run.state.eventHistory.filter((event) => event.kind === "primary");
}

function getEliminations(event: ResolvedEvent) {
  return event.changes.filter(
    (
      change,
    ): change is Extract<
      ResolvedEvent["changes"][number],
      {
        type: "eliminate-tribute";
      }
    > => change.type === "eliminate-tribute",
  );
}

function getAttemptingTributeId(event: ResolvedEvent): string | null {
  const attempt = event.changes.find(
    (change) => change.type === "increment-statistic" && change.statistic === "attemptedKills",
  );

  return attempt?.type === "increment-statistic" ? attempt.tributeId : null;
}

function classifyEliminationSource(event: ResolvedEvent): string {
  if (BLOODBATH_EVENT_IDS.has(event.definitionId)) {
    return "bloodbath";
  }

  if (DIRECT_COMBAT_EVENT_IDS.has(event.definitionId)) {
    return "direct-combat";
  }

  if (TACTICAL_EVENT_IDS.has(event.definitionId)) {
    return "tactical-immediate";
  }

  if (event.definitionId.startsWith("status-fatality:")) {
    return "status";
  }

  return "other";
}

function getGameSizeId(run: SimulationRun): GameSizeMetricId {
  return run.districtCount === 6 ? "half-game" : "full-game";
}

function createGameSizeMetrics(runs: readonly SimulationRun[]): GameSizeBalanceMetrics {
  const eliminationCounts = runs.map((run) =>
    run.state.eventHistory.reduce(
      (total, event) => total + getEliminations(event).length,

      0,
    ),
  );

  const primaryEventCounts = runs.map((run) => getPrimaryEvents(run).length);

  const completedGames = runs.filter((run) => run.state.victoryOutcome !== null).length;

  return {
    games: runs.length,

    completionRate: divide(completedGames, runs.length),

    rounds: createDistribution(runs.map((run) => run.roundsCompleted)),

    averagePrimaryEvents: getAverage(primaryEventCounts),

    averageEliminations: getAverage(eliminationCounts),
  };
}

function createStatValueMetrics(
  appearances: Record<number, number>,
  victories: Record<number, number>,
): StatValueBalanceMetric[] {
  return [1, 2, 3, 4, 5].map((value) => ({
    value,

    appearances: appearances[value] ?? 0,

    victories: victories[value] ?? 0,

    victoryRate: divide(
      victories[value] ?? 0,

      appearances[value] ?? 0,
    ),
  }));
}

export function collectBalanceMetrics(runs: readonly SimulationRun[]): BalanceMetrics {
  if (runs.length === 0) {
    throw new Error("Cannot collect balance metrics from an empty simulation sample.");
  }

  const runsBySize = {
    "half-game": runs.filter((run) => getGameSizeId(run) === "half-game"),

    "full-game": runs.filter((run) => getGameSizeId(run) === "full-game"),
  } satisfies Record<GameSizeMetricId, SimulationRun[]>;

  const eliminationSourceCounts = createCountRecord([
    "bloodbath",
    "direct-combat",
    "tactical-immediate",
    "status",
    "other",
  ]);

  const applicationCounts = createCountRecord(STATUS_CATALOGUE.map((status) => status.id));

  const fatalityCounts = createCountRecord(STATUS_CATALOGUE.map((status) => status.id));

  const acquisitionCounts = createCountRecord(ITEM_CATALOGUE.map((item) => item.id));

  const consumedUseCounts = createCountRecord(ITEM_CATALOGUE.map((item) => item.id));

  const acquisitionSourceCounts = createCountRecord(["cornucopia", "natural-foraging", "sponsor"]);

  const transferSourceCounts = createCountRecord(["theft", "death-loot", "other"]);

  const preparationCounts = Object.fromEntries(
    PREPARATION_MECHANICS.map((mechanic) => [mechanic, 0]),
  ) as Record<PreparationMechanic, number>;

  const familyEventCounts = createCountRecord(ACTIVE_EVENT_FAMILIES.map((family) => family.id));

  const familyGameCounts = createCountRecord(ACTIVE_EVENT_FAMILIES.map((family) => family.id));

  const statAppearances = Object.fromEntries(STAT_KEYS.map((stat) => [stat, {}])) as Record<
    keyof TributeStats,
    Record<number, number>
  >;

  const statVictories = Object.fromEntries(STAT_KEYS.map((stat) => [stat, {}])) as Record<
    keyof TributeStats,
    Record<number, number>
  >;

  const victorStatTotals: NumericTributeStats = {
    brains: 0,
    brawn: 0,
    luck: 0,
  };

  let victorCount = 0;

  let soleVictories = 0;
  let jointVictories = 0;

  let totalEliminations = 0;
  let dayOneEliminations = 0;

  let directAttempts = 0;
  let directSuccesses = 0;

  let tacticalAttempts = 0;
  let tacticalConnections = 0;
  let lowBrawnTacticalAttempts = 0;

  let delayedAttributedFatalities = 0;
  let safetyResolutions = 0;

  let preparationEventCount = 0;
  let borrowedItemEventCount = 0;

  const restQuality = {
    comfortable: 0,
    sheltered: 0,
    unsheltered: 0,
  };

  const camouflage = {
    successful: 0,
    unsuccessful: 0,
    harmfulFailure: 0,
  };

  let statusApplicationCount = 0;

  let acquisitionCount = 0;
  let consumedUses = 0;
  let transferCount = 0;

  for (const run of runs) {
    const victorIds = new Set(run.state.victoryOutcome?.victorTributeIds ?? []);

    if (run.state.victoryOutcome?.kind === "sole") {
      soleVictories += 1;
    }

    if (run.state.victoryOutcome?.kind === "joint") {
      jointVictories += 1;
    }

    for (const tribute of run.state.tributes) {
      for (const stat of STAT_KEYS) {
        const value = tribute.snapshot.stats[stat];

        incrementCount(statAppearances[stat], String(value));

        if (victorIds.has(tribute.id)) {
          incrementCount(statVictories[stat], String(value));

          victorStatTotals[stat] += value;
        }
      }

      if (victorIds.has(tribute.id)) {
        victorCount += 1;
      }
    }

    const familiesSeen = new Set<string>();

    for (const event of run.state.eventHistory) {
      const eliminations = getEliminations(event);

      totalEliminations += eliminations.length;

      if (event.round.day === 1 && event.round.period === "day") {
        dayOneEliminations += eliminations.length;
      }

      if (eliminations.length > 0) {
        incrementCount(
          eliminationSourceCounts,
          classifyEliminationSource(event),
          eliminations.length,
        );
      }

      if (event.resolutionMode === "safety") {
        safetyResolutions += 1;
      }

      if (event.definitionId.startsWith("status-fatality:")) {
        const statusId = event.definitionId.slice("status-fatality:".length);

        incrementCount(fatalityCounts, statusId, eliminations.length);

        if (eliminations.some((elimination) => elimination.killerTributeIds.length > 0)) {
          delayedAttributedFatalities += eliminations.length;
        }
      }

      for (const change of event.changes) {
        if (change.type === "apply-status") {
          statusApplicationCount += 1;

          incrementCount(applicationCounts, change.status.definitionId);
        }

        /*
         * Rest is now recorded by visible primary events rather
         * than automatic night-rest preparation.
         */
        if (change.type === "record-night-rest") {
          restQuality[change.quality] += 1;
        }
      }

      if (event.kind === "preparation" && event.preparation) {
        preparationEventCount += 1;

        preparationCounts[event.preparation.mechanic] += 1;

        if (
          event.preparation.itemOwnerTributeId &&
          event.preparation.itemOwnerTributeId !== event.preparation.actingTributeId
        ) {
          borrowedItemEventCount += 1;
        }

        if (event.preparation.mechanic === "camouflage-preparation") {
          const appliedDefinitions = event.changes
            .filter(
              (
                change,
              ): change is Extract<
                ResolvedEvent["changes"][number],
                {
                  type: "apply-status";
                }
              > => change.type === "apply-status",
            )
            .map((change) => getStatusDefinition(change.status.definitionId));

          if (appliedDefinitions.some((definition) => definition.id === "hidden")) {
            camouflage.successful += 1;
          } else {
            camouflage.unsuccessful += 1;
          }

          if (appliedDefinitions.some((definition) => definition.kind === "harmful")) {
            camouflage.harmfulFailure += 1;
          }
        }
      }

      if (event.kind === "primary") {
        for (const family of ACTIVE_EVENT_FAMILIES) {
          if (!family.eventIds.has(event.definitionId)) {
            continue;
          }

          incrementCount(familyEventCounts, family.id);

          familiesSeen.add(family.id);

          break;
        }

        const attackerId = getAttemptingTributeId(event);

        if (DIRECT_COMBAT_EVENT_IDS.has(event.definitionId)) {
          directAttempts += 1;

          if (
            eliminations.some(
              (elimination) =>
                attackerId !== null && elimination.killerTributeIds.includes(attackerId),
            )
          ) {
            directSuccesses += 1;
          }
        }

        if (TACTICAL_EVENT_IDS.has(event.definitionId)) {
          tacticalAttempts += 1;

          const attacker = run.state.tributes.find((tribute) => tribute.id === attackerId);

          if (attacker && attacker.snapshot.stats.brawn <= 2) {
            lowBrawnTacticalAttempts += 1;
          }

          const connected =
            eliminations.some(
              (elimination) =>
                attackerId !== null && elimination.killerTributeIds.includes(attackerId),
            ) ||
            event.changes.some(
              (change) =>
                change.type === "apply-status" &&
                change.status.sourceTributeId === attackerId &&
                getStatusDefinition(change.status.definitionId).kind === "harmful",
            );

          if (connected) {
            tacticalConnections += 1;
          }
        }
      }
    }

    for (const familyId of familiesSeen) {
      incrementCount(familyGameCounts, familyId);
    }

    for (const transaction of run.state.itemTransactions) {
      const definition = getItemDefinition(transaction.definitionId);

      if (transaction.type === "acquired") {
        acquisitionCount += 1;

        incrementCount(acquisitionSourceCounts, transaction.acquisitionSource);

        incrementCount(acquisitionCounts, definition.id);
      }

      if (transaction.type === "consumed") {
        consumedUses += transaction.uses;

        incrementCount(consumedUseCounts, definition.id, transaction.uses);
      }

      if (transaction.type === "transferred") {
        transferCount += 1;

        const source =
          transaction.sourceId === "theft" || transaction.sourceId === "death-loot"
            ? transaction.sourceId
            : "other";

        incrementCount(transferSourceCounts, source);
      }
    }
  }

  const neverAcquiredItemIds = ITEM_CATALOGUE.filter(
    (definition) => (acquisitionCounts[definition.id] ?? 0) === 0,
  ).map((definition) => definition.id);

  return {
    sample: {
      totalGames: runs.length,

      halfGames: runsBySize["half-game"].length,

      fullGames: runsBySize["full-game"].length,
    },

    gameSizes: {
      "half-game": createGameSizeMetrics(runsBySize["half-game"]),

      "full-game": createGameSizeMetrics(runsBySize["full-game"]),
    },

    victories: {
      sole: soleVictories,

      joint: jointVictories,

      soleRate: divide(soleVictories, runs.length),

      jointRate: divide(jointVictories, runs.length),
    },

    eliminations: {
      total: totalEliminations,

      dayOne: dayOneEliminations,

      dayOneShare: divide(dayOneEliminations, totalEliminations),

      bySource: eliminationSourceCounts,
    },

    combat: {
      directAttempts,

      directSuccesses,

      directFailures: directAttempts - directSuccesses,

      directSuccessRate: divide(directSuccesses, directAttempts),

      tacticalAttempts,

      tacticalConnections,

      tacticalConnectionRate: divide(tacticalConnections, tacticalAttempts),

      lowBrawnTacticalAttempts,

      delayedAttributedFatalities,

      safetyResolutions,
    },

    preparation: {
      totalEvents: preparationEventCount,

      byMechanic: preparationCounts,

      borrowedItemEvents: borrowedItemEventCount,

      restQuality,

      camouflage,
    },

    statuses: {
      totalApplications: statusApplicationCount,

      applicationsByStatus: applicationCounts,

      fatalitiesByStatus: fatalityCounts,
    },

    inventory: {
      totalAcquisitions: acquisitionCount,

      totalConsumedUses: consumedUses,

      totalTransfers: transferCount,

      averageAcquisitionsPerGame: divide(acquisitionCount, runs.length),

      averageConsumedUsesPerGame: divide(consumedUses, runs.length),

      averageTransfersPerGame: divide(transferCount, runs.length),

      acquisitionSources: acquisitionSourceCounts,

      transferSources: transferSourceCounts,

      acquisitionsByItem: acquisitionCounts,

      consumedUsesByItem: consumedUseCounts,

      distinctItemsAcquired: ITEM_CATALOGUE.length - neverAcquiredItemIds.length,

      neverAcquiredItemIds,
    },

    eventFamilies: ACTIVE_EVENT_FAMILIES.map((family) => ({
      id: family.id,

      label: family.label,

      eventCount: familyEventCounts[family.id] ?? 0,

      gamesWithEvent: familyGameCounts[family.id] ?? 0,

      eventsPerGame: divide(
        familyEventCounts[family.id] ?? 0,

        runs.length,
      ),
    })),

    victorStats: {
      average: {
        brains: divide(victorStatTotals.brains, victorCount),

        brawn: divide(victorStatTotals.brawn, victorCount),

        luck: divide(victorStatTotals.luck, victorCount),
      },

      byValue: {
        brains: createStatValueMetrics(statAppearances.brains, statVictories.brains),

        brawn: createStatValueMetrics(statAppearances.brawn, statVictories.brawn),

        luck: createStatValueMetrics(statAppearances.luck, statVictories.luck),
      },
    },
  };
}
