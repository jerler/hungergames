import { describe, expect, it } from "vitest";
import { TACTICAL_EVENTS } from "~/game/events/catalogue/encounters/tactical-events";
import { createInitialGameState } from "~/game/engine/create-initial-game-state";
import { assertGameStateInvariants } from "~/game/engine/game-invariants";
import { createSeededRandom } from "~/game/engine/random";
import { selectLivingTributes } from "~/game/selectors/game-selectors";
import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { createRandomTributeDrafts } from "~/game/tributes/tribute-drafts";
import type { DistrictCount } from "~/game/types/game-config";
import { createDefaultGameConfig } from "~/game/types/game-config";
import { gameReducer } from "~/state/game-reducer";
import { getCommittedItemInstanceIds } from "~/game/items/item-reservations";
import type {
  AcquiredInventoryTransaction,
  GameChange,
  GameState,
  ResolvedEvent,
  RoundReference,
  TransferredInventoryTransaction,
} from "~/game/types/game-state";
import { BLOODBATH_EVENT_CATALOGUE, CORNUCOPIA_EVENTS } from "~/game/events/catalogue/bloodbath";
import { FORAGING_EVENTS } from "~/game/events/catalogue/encounters/foraging-events";
import { HUNTING_EVENTS } from "~/game/events/catalogue/encounters/hunting-events";
import { ENVIRONMENTAL_EVENTS } from "~/game/events/catalogue/encounters/environmental-events";
import { DEPRIVATION_EVENTS } from "~/game/events/catalogue/encounters/deprivation-events";
import { ITEM_USE_EVENTS } from "~/game/events/catalogue/encounters/item-use-events";
import { SURVIVAL_EVENTS } from "~/game/events/catalogue/encounters/survival-events";
import { THEFT_EVENTS } from "~/game/events/catalogue/encounters/theft-events";
import {
  FOOD_THEFT_EVENTS,
  WATER_THEFT_EVENTS,
} from "~/game/events/catalogue/encounters/resource-theft-events";
import { RELATIONSHIP_EVENTS } from "~/game/events/catalogue/relationships";
import { STAT_GATED_EVENTS } from "~/game/events/catalogue/stat-gated";
import type { ItemDefinitionId } from "~/game/items/item-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { COMBAT_EVENTS } from "~/game/events/catalogue/encounters/combat-events";
import {
  CORNUCOPIA_CENTRALLY_AWARDED_ITEM_IDS,
  CORNUCOPIA_PACK_ITEM_POOL,
  type CornucopiaPackRarity,
} from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import { evaluateBalanceGuardrails } from "~/game/simulation/balance-guardrails";

import { collectBalanceMetrics } from "~/game/simulation/balance-metrics";

import { simulateGameBatch } from "~/game/simulation/simulation-runner";

const STATUS_CONSUMABLE_ITEM_IDS = new Set<ItemDefinitionId>([
  "burger-and-fries",
  "coffee",
  "coca-cola",
  "energy-drink",
  "hot-chocolate",
  "herbal-tea",
]);

const simulationCache = new Map<string, GameState>();

type TransferItemChange = Extract<
  GameChange,
  {
    type: "transfer-item";
  }
>;

const CORNUCOPIA_EVENT_IDS = new Set(CORNUCOPIA_EVENTS.map((event) => event.id));
const ORDINARY_COMBAT_EVENT_IDS = new Set(COMBAT_EVENTS.map((event) => event.id));
const TACTICAL_EVENT_IDS = new Set(TACTICAL_EVENTS.map((event) => event.id));
const CORNUCOPIA_PACK_ENTRY_BY_ITEM_ID = new Map<
  ItemDefinitionId,
  (typeof CORNUCOPIA_PACK_ITEM_POOL)[number]
>(CORNUCOPIA_PACK_ITEM_POOL.map((entry) => [entry.itemId, entry]));
const CORNUCOPIA_CENTRALLY_AWARDED_ITEM_ID_SET = new Set<ItemDefinitionId>(
  CORNUCOPIA_CENTRALLY_AWARDED_ITEM_IDS,
);

const SIMULATION_EVENT_FAMILIES = [
  ["bloodbath", new Set(BLOODBATH_EVENT_CATALOGUE.map((event) => event.id))],
  ["combat", new Set(COMBAT_EVENTS.map((event) => event.id))],
  ["tactical", new Set(TACTICAL_EVENTS.map((event) => event.id))],
  ["theft", new Set(THEFT_EVENTS.map((event) => event.id))],
  ["food-theft", new Set(FOOD_THEFT_EVENTS.map((event) => event.id))],
  ["water-theft", new Set(WATER_THEFT_EVENTS.map((event) => event.id))],
  ["environmental", new Set(ENVIRONMENTAL_EVENTS.map((event) => event.id))],
  ["survival", new Set(SURVIVAL_EVENTS.map((event) => event.id))],
  ["deprivation", new Set(DEPRIVATION_EVENTS.map((event) => event.id))],
  ["item-use", new Set(ITEM_USE_EVENTS.map((event) => event.id))],
  ["stat-gated", new Set(STAT_GATED_EVENTS.map((event) => event.id))],
  ["relationship", new Set(RELATIONSHIP_EVENTS.map((event) => event.id))],
  ["hunting", new Set(HUNTING_EVENTS.map((event) => event.id))],
  ["foraging", new Set(FORAGING_EVENTS.map((event) => event.id))],
] as const;

function getPrimaryEvents(state: GameState): ResolvedEvent[] {
  return state.eventHistory.filter((event) => event.kind === "primary");
}

interface ResolvedTransfer {
  event: ResolvedEvent;
  change: TransferItemChange;
}

function isDayOneDaytime(round: RoundReference): boolean {
  return round.day === 1 && round.period === "day";
}

function roundsMatch(first: RoundReference, second: RoundReference): boolean {
  return first.day === second.day && first.period === second.period;
}

function getAverage(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("Cannot average an empty collection.");
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getCornucopiaParticipationRate(state: GameState): number {
  const participantIds = new Set(
    getPrimaryEvents(state)
      .filter(
        (event) => isDayOneDaytime(event.round) && CORNUCOPIA_EVENT_IDS.has(event.definitionId),
      )
      .flatMap((event) => event.participantTributeIds),
  );

  return participantIds.size / state.tributes.length;
}

function getAcquisitionTransactions(state: GameState): AcquiredInventoryTransaction[] {
  return state.itemTransactions.filter(
    (transaction): transaction is AcquiredInventoryTransaction => transaction.type === "acquired",
  );
}

function getCornucopiaPackAcquisitions(state: GameState): AcquiredInventoryTransaction[] {
  const definitionIdByEventId = new Map(
    state.eventHistory.map((event) => [event.id, event.definitionId]),
  );

  return getAcquisitionTransactions(state).filter(
    (transaction) =>
      definitionIdByEventId.get(transaction.sourceId) === "cornucopia-nearby-pack" &&
      !CORNUCOPIA_CENTRALLY_AWARDED_ITEM_ID_SET.has(transaction.definitionId),
  );
}

function getTransferTransactions(state: GameState): TransferredInventoryTransaction[] {
  return state.itemTransactions.filter(
    (transaction): transaction is TransferredInventoryTransaction =>
      transaction.type === "transferred",
  );
}

function getAcquisitionByItemInstanceId(
  state: GameState,
): Map<string, AcquiredInventoryTransaction> {
  return new Map(
    getAcquisitionTransactions(state).map((transaction) => [
      transaction.itemInstanceId,
      transaction,
    ]),
  );
}

function getPostDayOneManufacturedTransferChanges(state: GameState): ResolvedTransfer[] {
  const acquisitionByItemInstanceId = getAcquisitionByItemInstanceId(state);

  return state.eventHistory.flatMap((event): ResolvedTransfer[] => {
    if (isDayOneDaytime(event.round)) {
      return [];
    }

    return event.changes.flatMap((change): ResolvedTransfer[] => {
      if (change.type !== "transfer-item") {
        return [];
      }

      const acquisition = acquisitionByItemInstanceId.get(change.itemInstanceId);

      if (!acquisition) {
        throw new Error(
          `Transferred item "${change.itemInstanceId}" ` + "has no acquisition transaction.",
        );
      }

      if (getItemDefinition(acquisition.definitionId).origin !== "manufactured") {
        return [];
      }

      return [
        {
          event,
          change,
        },
      ];
    });
  });
}

function getPostDayOneManufacturedTransferTransactions(
  state: GameState,
): TransferredInventoryTransaction[] {
  return getTransferTransactions(state).filter(
    (transaction) =>
      !isDayOneDaytime(transaction.round) &&
      getItemDefinition(transaction.definitionId).origin === "manufactured",
  );
}

interface SimulateGameOptions {
  useCache?: boolean;
}

function createSimulationGame(seed: string, districtCount: DistrictCount): GameState {
  const config = {
    ...createDefaultGameConfig(),
    districtCount,
  };

  let nextId = 0;

  return createInitialGameState(
    config,
    createRandomTributeDrafts(
      districtCount,
      DEFAULT_TRIBUTES,
      createSeededRandom(`${seed}:reaping`),
    ),
    "random",
    {
      createId: () => {
        nextId += 1;

        return `${seed}-id-${nextId}`;
      },

      now: "2026-07-18T12:00:00.000Z",
      seed,
    },
  );
}
function expectNoCrossEventItemCommitments(events: readonly ResolvedEvent[], seed: string): void {
  const eventIdByItemInstanceId = new Map<string, string>();

  for (const event of events) {
    /*
     * One event may reference the same item more than once
     * internally. The conflict being tested is commitment
     * by two separate events in the same planned round.
     */
    const eventItemInstanceIds = new Set(getCommittedItemInstanceIds(event.changes));

    for (const itemInstanceId of eventItemInstanceIds) {
      const previousEventId = eventIdByItemInstanceId.get(itemInstanceId);

      expect(
        previousEventId,

        `Simulation "${seed}" committed item ` +
          `"${itemInstanceId}" in both ` +
          `"${previousEventId}" and ` +
          `"${event.id}".`,
      ).toBeUndefined();

      eventIdByItemInstanceId.set(itemInstanceId, event.id);
    }
  }
}

function expectCompleteNightRestCoverage(
  state: GameState,
  events: readonly ResolvedEvent[],
  seed: string,
): void {
  const round = state.currentRound;

  if (!round || round.period !== "night") {
    return;
  }

  const eliminatedTributeIds = new Set(
    events.flatMap((event) =>
      event.changes.flatMap((change) =>
        change.type === "eliminate-tribute" ? [change.tributeId] : [],
      ),
    ),
  );

  const restCounts = new Map<string, number>();

  for (const event of events) {
    for (const change of event.changes) {
      if (change.type !== "record-night-rest") {
        continue;
      }

      expect(change.round).toEqual(round);

      restCounts.set(change.tributeId, (restCounts.get(change.tributeId) ?? 0) + 1);
    }
  }

  for (const tribute of state.tributes.filter((candidate) => candidate.isAlive)) {
    const count = restCounts.get(tribute.id) ?? 0;

    if (eliminatedTributeIds.has(tribute.id)) {
      expect(
        count,
        `Simulation "${seed}" recorded duplicate rest ` + `for eliminated tribute "${tribute.id}".`,
      ).toBeLessThanOrEqual(1);

      continue;
    }

    expect(
      count,
      `Simulation "${seed}" recorded ${count} rest outcomes ` +
        `for surviving tribute "${tribute.id}".`,
    ).toBe(1);
  }
}

function simulateGame(
  seed: string,
  districtCount: DistrictCount,
  { useCache = true }: SimulateGameOptions = {},
): GameState {
  const cacheKey = `${districtCount}:${seed}`;

  if (useCache) {
    const cachedResult = simulationCache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }
  }

  let state: GameState | null = createSimulationGame(seed, districtCount);

  assertGameStateInvariants(state);

  for (let roundIndex = 0; roundIndex < 100; roundIndex += 1) {
    state = gameReducer(state, {
      type: "round/began",

      now: `round-${roundIndex}-start`,
    });

    if (!state) {
      throw new Error(`Simulation "${seed}" lost its GameState while beginning a round.`);
    }

    expectCompleteNightRestCoverage(state, state.roundEvents, seed);

    expectNoCrossEventItemCommitments(state.roundEvents, seed);

    state = gameReducer(state, {
      type: "round/revealed",

      now: `round-${roundIndex}-end`,
    });

    if (!state) {
      throw new Error(`Simulation "${seed}" lost its GameState while revealing a round.`);
    }

    assertGameStateInvariants(state);

    if (state.phase === "victory") {
      if (useCache) {
        simulationCache.set(cacheKey, state);
      }

      return state;
    }
  }

  throw new Error(`Simulation "${seed}" failed to produce a victor.`);
}

function expectValidVictoryOutcome(result: GameState): void {
  const victoryOutcome = result.victoryOutcome;

  expect(victoryOutcome).not.toBeNull();

  if (!victoryOutcome) {
    throw new Error("The completed simulation has no victory outcome.");
  }

  const livingTributes = selectLivingTributes(result);

  expect([1, 2]).toContain(livingTributes.length);

  expect(livingTributes).toHaveLength(victoryOutcome.victorTributeIds.length);

  expect(new Set(victoryOutcome.victorTributeIds)).toEqual(
    new Set(livingTributes.map((tribute) => tribute.id)),
  );
}

function getStressResults(): GameState[] {
  return [
    ...Array.from(
      {
        length: 200,
      },

      (_, index) => simulateGame(`half-game-${index}`, 6),
    ),

    ...Array.from(
      {
        length: 100,
      },

      (_, index) => simulateGame(`full-game-${index}`, 12),
    ),
  ];
}

describe("simulation stress tests", () => {
  it("completes 200 Half Games without violating invariants", () => {
    for (let index = 0; index < 200; index += 1) {
      const result = simulateGame(`half-game-${index}`, 6);

      expectValidVictoryOutcome(result);
    }
  });

  it("completes 100 Full Games without violating invariants", () => {
    for (let index = 0; index < 100; index += 1) {
      const result = simulateGame(`full-game-${index}`, 12);

      expectValidVictoryOutcome(result);
    }
  });

  it("independently replays the same seed identically", () => {
    const firstResult = simulateGame("repeatable-game", 12, {
      useCache: false,
    });

    const secondResult = simulateGame("repeatable-game", 12, {
      useCache: false,
    });

    /*
     * Prove these are two separately simulated objects,
     * not the same cached result.
     */
    expect(firstResult).not.toBe(secondResult);

    expect(secondResult).toEqual(firstResult);
  });

  it("classifies sequenced catalogue events as primary", () => {
    for (const result of getStressResults()) {
      for (const event of result.eventHistory) {
        const isCatalogueEvent = SIMULATION_EVENT_FAMILIES.some(([, eventIds]) =>
          eventIds.has(event.definitionId),
        );

        if (isCatalogueEvent) {
          expect(event.kind).toBe("primary");
        }

        if (event.definitionId.startsWith("status-fatality:")) {
          expect(event.kind).toBe("status-resolution");
        }

        if (
          event.definitionId === "truce-expired" ||
          event.definitionId === "truce-ended-by-death" ||
          event.definitionId === "romantic-truce-ended-by-death"
        ) {
          expect(event.kind).toBe("aftermath");
        }
      }
    }
  });

  it("exercises ordinary theft during full-game simulations", () => {
    const theftEvents = getStressResults().flatMap((result) =>
      getPrimaryEvents(result).filter(
        (event) => event.definitionId === "steal-from-stronger-tribute",
      ),
    );

    expect(theftEvents.length).toBeGreaterThan(0);

    for (const event of theftEvents) {
      /*
       * Day 1 daytime belongs exclusively to the
       * Bloodbath sequencer.
       */
      expect(event.round.day === 1 && event.round.period === "day").toBe(false);

      const theftTransfers = event.changes.filter(
        (change): change is TransferItemChange =>
          change.type === "transfer-item" && change.reason === "theft",
      );

      expect(theftTransfers.length).toBeLessThanOrEqual(2);

      expect(new Set(theftTransfers.map((change) => change.itemInstanceId)).size).toBe(
        theftTransfers.length,
      );
    }
  });

  it("exercises checked ordinary combat with valid success and failure outcomes", () => {
    const combatEvents = getStressResults().flatMap((result) =>
      getPrimaryEvents(result).filter((event) => ORDINARY_COMBAT_EVENT_IDS.has(event.definitionId)),
    );

    expect(combatEvents.length).toBeGreaterThan(0);

    let successfulAttackCount = 0;
    let failedAttackCount = 0;

    for (const event of combatEvents) {
      const eliminations = event.changes.filter((change) => change.type === "eliminate-tribute");

      const attemptedKills = event.changes.filter(
        (change) => change.type === "increment-statistic" && change.statistic === "attemptedKills",
      );

      const kills = event.changes.filter(
        (change) => change.type === "increment-statistic" && change.statistic === "kills",
      );

      const weaponUses = event.changes.filter(
        (change) => change.type === "use-item" || change.type === "consume-item",
      );

      /*
       * Every checked attack records exactly one attempt and
       * commits exactly one selected weapon, whether it succeeds
       * or fails.
       */
      expect(attemptedKills).toHaveLength(1);
      expect(weaponUses).toHaveLength(1);

      /*
       * A checked attack may eliminate one target or fail
       * without eliminating anyone.
       */
      expect(eliminations.length).toBeLessThanOrEqual(1);

      if (eliminations.length === 1) {
        successfulAttackCount += 1;

        expect(kills).toHaveLength(1);

        expect(eliminations[0].killerTributeIds).toHaveLength(1);

        expect(kills[0]).toMatchObject({
          tributeId: eliminations[0].killerTributeIds[0],
          amount: 1,
        });
      } else {
        failedAttackCount += 1;

        expect(kills).toHaveLength(0);

        /*
         * Safety-mode direct attacks must force success, so any
         * failed checked attack must have resolved normally.
         */
        expect(event.resolutionMode).toBe("standard");
      }

      if (event.resolutionMode === "safety") {
        expect(eliminations).toHaveLength(1);
        expect(kills).toHaveLength(1);
      }
    }

    /*
     * Across the stress sample, prove that checked combat
     * actually exercises both sides of the attack check.
     */
    expect(successfulAttackCount).toBeGreaterThan(0);
    expect(failedAttackCount).toBeGreaterThan(0);
  });

  it("keeps actual Cornucopia participation within its target range", () => {
    const participationRates = getStressResults().map(getCornucopiaParticipationRate);

    for (const participationRate of participationRates) {
      expect(participationRate).toBeGreaterThanOrEqual(0.5);

      expect(participationRate).toBeLessThanOrEqual(0.9);
    }

    expect(new Set(participationRates).size).toBeGreaterThan(1);

    const meanParticipation = getAverage(participationRates);

    /*
     * The strategy-level test uses the tighter 72–78%
     * range over 5,000 samples. Keep the complete-game
     * assertion broader so it detects real balance drift
     * without becoming unnecessarily brittle.
     */
    expect(meanParticipation).toBeGreaterThan(0.7);

    expect(meanParticipation).toBeLessThan(0.8);
  });

  it("creates manufactured items only through valid acquisition sources", () => {
    let postDayOneNaturalAcquisitionCount = 0;
    let craftedWeaponAcquisitionCount = 0;

    for (const result of getStressResults()) {
      for (const transaction of getAcquisitionTransactions(result)) {
        const definition = getItemDefinition(transaction.definitionId);

        if (definition.origin === "manufactured") {
          if (isDayOneDaytime(transaction.round)) {
            expect(transaction.acquisitionSource).toBe("cornucopia");
          } else {
            expect(transaction.acquisitionSource).toBe("crafted");
            expect(["knife", "club", "hand-axe", "bow"]).toContain(transaction.definitionId);
            craftedWeaponAcquisitionCount += 1;
          }

          continue;
        }

        if (
          !isDayOneDaytime(transaction.round) &&
          transaction.acquisitionSource === "natural-foraging"
        ) {
          postDayOneNaturalAcquisitionCount += 1;
        }
      }
    }

    expect(postDayOneNaturalAcquisitionCount).toBeGreaterThan(0);
    expect(craftedWeaponAcquisitionCount).toBeGreaterThan(0);
  });

  it("keeps weighted Cornucopia pack acquisitions legal and balanced", () => {
    const acquisitions = getStressResults().flatMap(getCornucopiaPackAcquisitions);

    expect(acquisitions.length).toBeGreaterThan(0);

    const rarityCounts: Record<CornucopiaPackRarity, number> = {
      common: 0,
      standard: 0,
      uncommon: 0,
      rare: 0,
    };

    let statusConsumableCount = 0;
    let medicalCount = 0;

    for (const acquisition of acquisitions) {
      const entry = CORNUCOPIA_PACK_ENTRY_BY_ITEM_ID.get(acquisition.definitionId);

      expect(entry).toBeDefined();

      if (!entry) {
        continue;
      }

      rarityCounts[entry.rarity] += 1;

      const definition = getItemDefinition(acquisition.definitionId);

      expect(definition.origin).toBe("manufactured");

      expect(acquisition.acquisitionSource).toBe("cornucopia");

      if (STATUS_CONSUMABLE_ITEM_IDS.has(acquisition.definitionId)) {
        statusConsumableCount += 1;
      }

      if (definition.tags.includes("medicine")) {
        medicalCount += 1;
      }
    }
    expect(statusConsumableCount).toBeGreaterThan(0);

    expect(medicalCount).toBeGreaterThan(0);

    expect(rarityCounts.common + rarityCounts.standard).toBeGreaterThan(
      rarityCounts.uncommon + rarityCounts.rare,
    );

    expect(rarityCounts.common).toBeGreaterThan(rarityCounts.rare);

    expect(rarityCounts.rare / acquisitions.length).toBeLessThan(0.15);
  });

  it("records every post-Day-1 manufactured ownership change as one transfer transaction", () => {
    let theftTransferCount = 0;
    let deathLootTransferCount = 0;

    for (const result of getStressResults()) {
      const resolvedTransfers = getPostDayOneManufacturedTransferChanges(result);

      const ledgerTransfers = getPostDayOneManufacturedTransferTransactions(result);

      expect(ledgerTransfers).toHaveLength(resolvedTransfers.length);

      for (const { event, change } of resolvedTransfers) {
        const matchingTransactions = ledgerTransfers.filter(
          (transaction) =>
            transaction.itemInstanceId === change.itemInstanceId &&
            transaction.fromTributeId === change.fromTributeId &&
            transaction.toTributeId === change.toTributeId &&
            transaction.sourceId === change.reason &&
            roundsMatch(transaction.round, event.round) &&
            transaction.id.startsWith(`transfer:${event.id}:`),
        );

        expect(matchingTransactions).toHaveLength(1);

        if (change.reason === "theft") {
          theftTransferCount += 1;
        }

        if (change.reason === "death-loot") {
          deathLootTransferCount += 1;
        }
      }
    }

    /*
     * These assertions confirm that both mechanics are not
     * merely valid in unit tests, but are exercised during
     * complete seeded games after the Bloodbath.
     */
    expect(theftTransferCount).toBeGreaterThan(0);

    expect(deathLootTransferCount).toBeGreaterThan(0);
  });

  it("stays within established simulation balance guardrails", () => {
    /*
     * Timeline-aware deprivation metrics require the pre-round
     * snapshots produced by the shared simulation runner.
     *
     * Final GameState objects alone cannot establish whether a
     * hungry or thirsty application was eligible at selection time.
     */
    const runs = simulateGameBatch([
      {
        seedPrefix: "half-game",
        count: 200,
        districtCount: 6,
      },
      {
        seedPrefix: "full-game",
        count: 100,
        districtCount: 12,
      },
    ]);

    const metrics = collectBalanceMetrics(runs);

    const failedGuardrails = evaluateBalanceGuardrails(metrics).filter(
      (guardrail) => !guardrail.passed,
    );

    expect(
      failedGuardrails,

      failedGuardrails
        .map(
          (guardrail) =>
            `${guardrail.label}: actual ${guardrail.actual}; expected ${guardrail.expected}`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("exercises tactical offense by low-Brawn tributes in complete games", () => {
    const attempts = getStressResults().flatMap((result) =>
      getPrimaryEvents(result)
        .filter((event) => TACTICAL_EVENT_IDS.has(event.definitionId))
        .map((event) => {
          const attemptChange = event.changes.find(
            (change) =>
              change.type === "increment-statistic" && change.statistic === "attemptedKills",
          );

          if (!attemptChange || attemptChange.type !== "increment-statistic") {
            throw new Error(`Tactical event "${event.id}" recorded no attacker.`);
          }

          const attacker = result.tributes.find(
            (tribute) => tribute.id === attemptChange.tributeId,
          );

          if (!attacker) {
            throw new Error(`Tactical event "${event.id}" references a missing attacker.`);
          }

          return {
            event,
            attacker,
          };
        }),
    );

    expect(attempts.length).toBeGreaterThan(0);

    /*
     * Complete simulations prove that the acquisition
     * and selection systems make tactical equipment
     * reachable by the intended low-Brawn users.
     *
     * Controlled Brains success-rate comparisons belong
     * in combat-strategy-balance.test.ts.
     */
    expect(attempts.some(({ attacker }) => attacker.snapshot.stats.brawn <= 2)).toBe(true);

    for (const { event } of attempts) {
      expect(event.resolutionMode).toBe("standard");

      expect(
        event.changes.filter(
          (change) =>
            change.type === "increment-statistic" && change.statistic === "attemptedKills",
        ),
      ).toHaveLength(1);

      expect(
        event.changes.filter(
          (change) => change.type === "use-item" || change.type === "consume-item",
        ),
      ).toHaveLength(1);
    }
  });
});
