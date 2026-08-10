import {
  assignBloodbathStrategies,
  type BloodbathStrategy,
} from "~/game/bloodbath/bloodbath-strategy";
import { getEffectiveStats } from "~/game/engine/effective-stats";
import { createSeededRandom } from "~/game/engine/random";
import { createRoundSeed } from "~/game/engine/rounds";
import {
  BLOODBATH_EVENT_CATALOGUE_FAMILIES,
  ORDINARY_EVENT_CATALOGUE_FAMILIES,
} from "~/game/events/catalogue/catalogue-families";
import { getEventAuditPrerequisiteEvidence } from "~/game/events/event-audit-prerequisites";
import type {
  EventAuditStatCondition,
  EventAuditStatValueSource,
  EventDefinition,
} from "~/game/events/event-schema";
import type {
  EventDistributionGameSizeId,
  EventDistributionPoolId,
} from "~/game/simulation/event-distribution-metrics";
import type { SimulationRun } from "~/game/simulation/simulation-runner";
import type {
  GameState,
  GameTribute,
  ResolvedEvent,
  RoundReference,
} from "~/game/types/game-state";
import type { TributeStats, TributeStatValue } from "~/game/types/tribute";

export const AUDIT_TRIBUTE_STATS = ["brains", "brawn", "luck"] as const;
export type AuditTributeStat = (typeof AUDIT_TRIBUTE_STATS)[number];

export const AUDIT_STAT_VALUES = [1, 2, 3, 4, 5] as const;

export const FOCUSED_STAT_GATE_DEFINITION_IDS = [
  "cornucopia-high-brains-decision-paralysis",
  "cornucopia-low-brains-not-a-box",
] as const;

export type FocusedStatGateDefinitionId = (typeof FOCUSED_STAT_GATE_DEFINITION_IDS)[number];

export type StatCountByValue = Record<TributeStatValue, number>;
export type RosterStatCounts = Record<AuditTributeStat, StatCountByValue>;

export interface BloodbathStrategyAssignmentEvidence {
  tributeId: string;
  sourceDefinitionId: string | null;
  stats: TributeStats;
  strategy: BloodbathStrategy;
}

export interface PerGameRosterStrategyEvidence {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  tributeCount: number;
  rosterStatCounts: RosterStatCounts;
  strategyAssignments: readonly BloodbathStrategyAssignmentEvidence[];
}

export interface StrategyByStatValueMetric {
  stat: AuditTributeStat;
  value: TributeStatValue;
  rosterCount: number;
  averageRosterCountPerGame: number;
  cornucopiaAssignments: number;
  fleeAssignments: number;
  cornucopiaRate: number;
}

export interface RosterStrategyGameSizeSummary {
  gameSize: EventDistributionGameSizeId;
  games: number;
  tributeCountPerGame: number;
  averageRosterStatCounts: RosterStatCounts;
  strategyByStatValue: readonly StrategyByStatValueMetric[];
}

export interface StatGatedSelectionEvidence {
  seed: string;
  gameSize: EventDistributionGameSizeId;
  poolId: EventDistributionPoolId;
  definitionId: string;
  resolvedEventId: string;
  roleId: string;
  participantTributeId: string;
  participantName: string;
  gateMode: "required" | "alternative";
  stat: AuditTributeStat;
  comparison: "eq" | "gte" | "lte";
  authoredThreshold: TributeStatValue;
  valueSource: EventAuditStatValueSource;
  selectedStatValue: TributeStatValue;
  satisfiesAuthoredThreshold: boolean;
  bloodbathStrategy: BloodbathStrategy | null;
}

export interface FocusedStatGateMetric {
  gameSize: EventDistributionGameSizeId;
  definitionId: FocusedStatGateDefinitionId;
  roleId: string;
  stat: AuditTributeStat;
  comparison: "eq" | "gte" | "lte";
  authoredThreshold: TributeStatValue;
  valueSource: EventAuditStatValueSource;
  games: number;
  gamesWithRosterCandidate: number;
  rosterPresenceRate: number;
  totalRosterCandidates: number;
  averageRosterCandidatesPerGame: number;
  cornucopiaCandidateAssignments: number;
  fleeCandidateAssignments: number;
  candidateCornucopiaRate: number;
  hardFeasibleGames: number;
  hardFeasibleOpportunities: number;
  weightedPoolGames: number;
  weightedPoolOpportunities: number;
  weightedPoolEntries: number;
  selectedGames: number;
  acceptedSelections: number;
  hardFeasibleToWeightedPoolConversion: number;
  weightedPoolEntryToSelectionConversion: number;
  hardFeasibleToSelectionConversion: number;
}

export interface RosterStrategyEvidenceReport {
  perGame: readonly PerGameRosterStrategyEvidence[];
  gameSizeSummaries: readonly RosterStrategyGameSizeSummary[];
  statGatedSelections: readonly StatGatedSelectionEvidence[];
  focusedDefinitions: readonly FocusedStatGateMetric[];
}

interface RoleStatGate {
  roleId: string;
  mode: "required" | "alternative";
  conditions: readonly EventAuditStatCondition[];
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function getGameSize(run: SimulationRun): EventDistributionGameSizeId {
  if (run.districtCount === 6) {
    return "half-game";
  }

  if (run.districtCount === 12) {
    return "full-game";
  }

  throw new Error(`Unsupported simulation district count "${String(run.districtCount)}".`);
}

function createEmptyStatCount(): StatCountByValue {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
}

function createEmptyRosterStatCounts(): RosterStatCounts {
  return {
    brains: createEmptyStatCount(),
    brawn: createEmptyStatCount(),
    luck: createEmptyStatCount(),
  };
}

function countRosterStats(tributes: readonly GameTribute[]): RosterStatCounts {
  const counts = createEmptyRosterStatCounts();

  for (const tribute of tributes) {
    for (const stat of AUDIT_TRIBUTE_STATS) {
      counts[stat][tribute.snapshot.stats[stat]] += 1;
    }
  }

  return counts;
}

export function getSimulationInitialState(run: SimulationRun): GameState {
  const initialState = run.roundSnapshots[0]?.state;

  if (!initialState) {
    throw new Error(`Simulation "${run.seed}" has no pre-round snapshot for roster auditing.`);
  }

  return initialState;
}

function getStateAtRound(run: SimulationRun, round: RoundReference): GameState {
  const snapshot = run.roundSnapshots.find(
    (candidate) => candidate.round.day === round.day && candidate.round.period === round.period,
  );

  if (!snapshot) {
    throw new Error(
      `Simulation "${run.seed}" has no pre-round snapshot for ` + `${round.period} ${round.day}.`,
    );
  }

  return snapshot.state;
}

export function replayBloodbathStrategyAssignments(
  run: SimulationRun,
): BloodbathStrategyAssignmentEvidence[] {
  const initialState = getSimulationInitialState(run);
  const round = {
    day: 1,
    period: "day",
  } as const;
  const random = createSeededRandom(createRoundSeed(initialState.seed, round));
  const plan = assignBloodbathStrategies(initialState.tributes, random);
  const tributeById = new Map(
    initialState.tributes.map((tribute) => [tribute.id, tribute] as const),
  );

  return plan.assignments.map(({ tributeId, strategy }) => {
    const tribute = tributeById.get(tributeId);

    if (!tribute) {
      throw new Error(`Bloodbath strategy replay references missing tribute "${tributeId}".`);
    }

    return {
      tributeId,
      sourceDefinitionId: tribute.sourceDefinitionId,
      stats: { ...tribute.snapshot.stats },
      strategy,
    };
  });
}

function createPerGameEvidence(run: SimulationRun): PerGameRosterStrategyEvidence {
  const initialState = getSimulationInitialState(run);

  return {
    seed: run.seed,
    gameSize: getGameSize(run),
    tributeCount: initialState.tributes.length,
    rosterStatCounts: countRosterStats(initialState.tributes),
    strategyAssignments: replayBloodbathStrategyAssignments(run),
  };
}

function getActiveDefinitionMap(): Map<string, EventDefinition> {
  const definitions = new Map<string, EventDefinition>();

  for (const family of [
    ...BLOODBATH_EVENT_CATALOGUE_FAMILIES,
    ...ORDINARY_EVENT_CATALOGUE_FAMILIES,
  ]) {
    for (const definition of family.events as readonly EventDefinition[]) {
      definitions.set(definition.id, definition);
    }
  }

  return definitions;
}

function getRoleStatGates(definition: EventDefinition): RoleStatGate[] {
  return getEventAuditPrerequisiteEvidence(definition).prerequisites.flatMap(
    (prerequisite): RoleStatGate[] => {
      switch (prerequisite.kind) {
        case "stat":
          return [
            {
              roleId: prerequisite.roleId,
              mode: "required",
              conditions: [prerequisite],
            },
          ];

        case "stat-any":
          return [
            {
              roleId: prerequisite.roleId,
              mode: "alternative",
              conditions: prerequisite.alternatives,
            },
          ];

        default:
          return [];
      }
    },
  );
}

export function getMissingStatPrerequisiteMetadataDefinitionIds(): string[] {
  return [...getActiveDefinitionMap().values()]
    .filter((definition) =>
      definition.selectionProfile?.specificityReasons.includes("stat-requirement"),
    )
    .filter((definition) => getRoleStatGates(definition).length === 0)
    .map((definition) => definition.id)
    .sort();
}

function classifyPrimaryPool(event: ResolvedEvent): EventDistributionPoolId | null {
  if (event.kind !== "primary") {
    return null;
  }

  if (event.feedGroup === "bloodbath-cornucopia") {
    return "bloodbath-cornucopia";
  }

  if (event.feedGroup === "bloodbath-flee") {
    return "bloodbath-flee";
  }

  if (event.round.period === "night") {
    return "night";
  }

  return event.round.day >= 2 ? "later-day" : null;
}

function getParticipantIdsByRole(
  definition: EventDefinition,
  event: ResolvedEvent,
): ReadonlyMap<string, readonly string[]> {
  const expectedParticipantCount = definition.roles.reduce((total, role) => total + role.count, 0);

  if (expectedParticipantCount !== event.participantTributeIds.length) {
    throw new Error(
      `Resolved event "${event.id}" contains ${event.participantTributeIds.length} ` +
        `participant IDs but definition "${definition.id}" declares ` +
        `${expectedParticipantCount}.`,
    );
  }

  const participantIdsByRole = new Map<string, readonly string[]>();
  let offset = 0;

  for (const role of definition.roles) {
    participantIdsByRole.set(
      role.id,
      event.participantTributeIds.slice(offset, offset + role.count),
    );
    offset += role.count;
  }

  return participantIdsByRole;
}

function getStatValue(tribute: GameTribute, condition: EventAuditStatCondition): TributeStatValue {
  const valueSource = condition.valueSource ?? "base";

  return valueSource === "effective"
    ? getEffectiveStats(tribute)[condition.stat]
    : tribute.snapshot.stats[condition.stat];
}

function satisfiesStatCondition(tribute: GameTribute, condition: EventAuditStatCondition): boolean {
  const value = getStatValue(tribute, condition);

  switch (condition.comparison) {
    case "eq":
      return value === condition.threshold;
    case "gte":
      return value >= condition.threshold;
    case "lte":
      return value <= condition.threshold;
  }
}

function createStatGatedSelectionEvidence(
  runs: readonly SimulationRun[],
): StatGatedSelectionEvidence[] {
  const definitionById = getActiveDefinitionMap();
  const rows: StatGatedSelectionEvidence[] = [];

  for (const run of runs) {
    const strategyByTributeId = new Map(
      replayBloodbathStrategyAssignments(run).map((assignment) => [
        assignment.tributeId,
        assignment.strategy,
      ]),
    );

    for (const event of run.state.eventHistory) {
      const poolId = classifyPrimaryPool(event);

      if (!poolId) {
        continue;
      }

      const definition = definitionById.get(event.definitionId);

      if (!definition) {
        continue;
      }

      const statGates = getRoleStatGates(definition);

      if (statGates.length === 0) {
        continue;
      }

      const roundState = getStateAtRound(run, event.round);
      const tributeById = new Map(
        roundState.tributes.map((tribute) => [tribute.id, tribute] as const),
      );
      const participantIdsByRole = getParticipantIdsByRole(definition, event);

      for (const gate of statGates) {
        const participantIds = participantIdsByRole.get(gate.roleId);

        if (!participantIds || participantIds.length === 0) {
          throw new Error(
            `Stat prerequisite for "${definition.id}" references role ` +
              `"${gate.roleId}" without a resolved participant.`,
          );
        }

        for (const participantTributeId of participantIds) {
          const tribute = tributeById.get(participantTributeId);

          if (!tribute) {
            throw new Error(
              `Resolved stat-gated event "${event.id}" references missing ` +
                `tribute "${participantTributeId}" in its pre-round state.`,
            );
          }

          const satisfiedConditions = gate.conditions.filter((condition) =>
            satisfiesStatCondition(tribute, condition),
          );

          if (
            (gate.mode === "required" && satisfiedConditions.length !== 1) ||
            (gate.mode === "alternative" && satisfiedConditions.length === 0)
          ) {
            throw new Error(
              `Selected participant "${participantTributeId}" does not satisfy ` +
                `the typed ${gate.mode} stat gate for "${definition.id}" ` +
                `role "${gate.roleId}".`,
            );
          }

          for (const condition of satisfiedConditions) {
            rows.push({
              seed: run.seed,
              gameSize: getGameSize(run),
              poolId,
              definitionId: definition.id,
              resolvedEventId: event.id,
              roleId: gate.roleId,
              participantTributeId,
              participantName: tribute.snapshot.name,
              gateMode: gate.mode,
              stat: condition.stat,
              comparison: condition.comparison,
              authoredThreshold: condition.threshold,
              valueSource: condition.valueSource ?? "base",
              selectedStatValue: getStatValue(tribute, condition),
              satisfiesAuthoredThreshold: true,
              bloodbathStrategy:
                poolId === "bloodbath-cornucopia" || poolId === "bloodbath-flee"
                  ? (strategyByTributeId.get(participantTributeId) ?? null)
                  : null,
            });
          }
        }
      }
    }
  }

  return rows.sort(
    (first, second) =>
      first.seed.localeCompare(second.seed) ||
      first.poolId.localeCompare(second.poolId) ||
      first.definitionId.localeCompare(second.definitionId) ||
      first.resolvedEventId.localeCompare(second.resolvedEventId) ||
      first.roleId.localeCompare(second.roleId) ||
      first.participantTributeId.localeCompare(second.participantTributeId) ||
      first.stat.localeCompare(second.stat),
  );
}

function createGameSizeSummaries(
  perGame: readonly PerGameRosterStrategyEvidence[],
): RosterStrategyGameSizeSummary[] {
  const gameSizes = [...new Set(perGame.map((entry) => entry.gameSize))].sort();

  return gameSizes.map((gameSize) => {
    const games = perGame.filter((entry) => entry.gameSize === gameSize);
    const averageRosterStatCounts = createEmptyRosterStatCounts();

    for (const stat of AUDIT_TRIBUTE_STATS) {
      for (const value of AUDIT_STAT_VALUES) {
        averageRosterStatCounts[stat][value] = divide(
          games.reduce((total, game) => total + game.rosterStatCounts[stat][value], 0),
          games.length,
        );
      }
    }

    const strategyByStatValue = AUDIT_TRIBUTE_STATS.flatMap((stat) =>
      AUDIT_STAT_VALUES.map((value): StrategyByStatValueMetric => {
        const assignments = games.flatMap((game) =>
          game.strategyAssignments.filter((assignment) => assignment.stats[stat] === value),
        );
        const cornucopiaAssignments = assignments.filter(
          (assignment) => assignment.strategy === "cornucopia",
        ).length;

        return {
          stat,
          value,
          rosterCount: assignments.length,
          averageRosterCountPerGame: divide(assignments.length, games.length),
          cornucopiaAssignments,
          fleeAssignments: assignments.length - cornucopiaAssignments,
          cornucopiaRate: divide(cornucopiaAssignments, assignments.length),
        };
      }),
    );

    const tributeCounts = new Set(games.map((game) => game.tributeCount));

    if (tributeCounts.size !== 1) {
      throw new Error(`Roster audit found inconsistent tribute counts for ${gameSize}.`);
    }

    return {
      gameSize,
      games: games.length,
      tributeCountPerGame: games[0]?.tributeCount ?? 0,
      averageRosterStatCounts,
      strategyByStatValue,
    };
  });
}

function getFocusedStatPrerequisite(definition: EventDefinition): {
  roleId: string;
  condition: EventAuditStatCondition;
} {
  const gates = getRoleStatGates(definition);

  if (gates.length !== 1 || gates[0]?.mode !== "required" || gates[0].conditions.length !== 1) {
    throw new Error(
      `Focused definition "${definition.id}" must expose exactly one required typed stat gate.`,
    );
  }

  return {
    roleId: gates[0].roleId,
    condition: gates[0].conditions[0]!,
  };
}

function createFocusedDefinitionMetrics({
  runs,
  perGame,
}: {
  runs: readonly SimulationRun[];
  perGame: readonly PerGameRosterStrategyEvidence[];
}): FocusedStatGateMetric[] {
  const definitionById = getActiveDefinitionMap();
  const output: FocusedStatGateMetric[] = [];

  for (const definitionId of FOCUSED_STAT_GATE_DEFINITION_IDS) {
    const definition = definitionById.get(definitionId);

    if (!definition) {
      throw new Error(`Focused Phase 2 definition "${definitionId}" is not active.`);
    }

    const { roleId, condition } = getFocusedStatPrerequisite(definition);

    for (const gameSize of ["half-game", "full-game"] as const) {
      const gameRuns = runs.filter((run) => getGameSize(run) === gameSize);

      if (gameRuns.length === 0) {
        continue;
      }

      const gameEvidence = perGame.filter((entry) => entry.gameSize === gameSize);
      const candidateIdsBySeed = new Map<string, string[]>();

      for (const run of gameRuns) {
        const initialState = getSimulationInitialState(run);
        const candidateIds = initialState.tributes
          .filter((tribute) => satisfiesStatCondition(tribute, condition))
          .map((tribute) => tribute.id);

        candidateIdsBySeed.set(run.seed, candidateIds);
      }

      const candidateAssignments = gameEvidence.flatMap((game) => {
        const candidateIds = new Set(candidateIdsBySeed.get(game.seed) ?? []);

        return game.strategyAssignments.filter((assignment) =>
          candidateIds.has(assignment.tributeId),
        );
      });
      const cornucopiaCandidateAssignments = candidateAssignments.filter(
        (assignment) => assignment.strategy === "cornucopia",
      ).length;
      const selectorRows = gameRuns.flatMap((run) => {
        if (!run.selectionDiagnostics) {
          throw new Error(`Phase 2 evidence requires selection diagnostics for "${run.seed}".`);
        }

        return (run.selectionDiagnostics.opportunities ?? []).filter(
          (row) => row.definitionId === definitionId && row.poolId === "bloodbath-cornucopia",
        );
      });
      const hardFeasibleRows = selectorRows.filter((row) => row.hardFeasible);
      const weightedRows = selectorRows.filter((row) => row.finalWeightedPool);
      const acceptedRows = selectorRows.filter((row) => row.resolvedAccepted);
      const totalRosterCandidates = [...candidateIdsBySeed.values()].reduce(
        (total, ids) => total + ids.length,
        0,
      );
      const gamesWithRosterCandidate = [...candidateIdsBySeed.values()].filter(
        (ids) => ids.length > 0,
      ).length;
      const weightedPoolEntries = weightedRows.reduce(
        (total, row) => total + row.weightedPoolEntryCount,
        0,
      );

      output.push({
        gameSize,
        definitionId,
        roleId,
        stat: condition.stat,
        comparison: condition.comparison,
        authoredThreshold: condition.threshold,
        valueSource: condition.valueSource ?? "base",
        games: gameRuns.length,
        gamesWithRosterCandidate,
        rosterPresenceRate: divide(gamesWithRosterCandidate, gameRuns.length),
        totalRosterCandidates,
        averageRosterCandidatesPerGame: divide(totalRosterCandidates, gameRuns.length),
        cornucopiaCandidateAssignments,
        fleeCandidateAssignments: candidateAssignments.length - cornucopiaCandidateAssignments,
        candidateCornucopiaRate: divide(
          cornucopiaCandidateAssignments,
          candidateAssignments.length,
        ),
        hardFeasibleGames: new Set(hardFeasibleRows.map((row) => row.gameSeed)).size,
        hardFeasibleOpportunities: hardFeasibleRows.length,
        weightedPoolGames: new Set(weightedRows.map((row) => row.gameSeed)).size,
        weightedPoolOpportunities: weightedRows.length,
        weightedPoolEntries,
        selectedGames: new Set(acceptedRows.map((row) => row.gameSeed)).size,
        acceptedSelections: acceptedRows.length,
        hardFeasibleToWeightedPoolConversion: divide(weightedRows.length, hardFeasibleRows.length),
        weightedPoolEntryToSelectionConversion: divide(acceptedRows.length, weightedPoolEntries),
        hardFeasibleToSelectionConversion: divide(acceptedRows.length, hardFeasibleRows.length),
      });
    }
  }

  return output.sort(
    (first, second) =>
      first.gameSize.localeCompare(second.gameSize) ||
      first.definitionId.localeCompare(second.definitionId),
  );
}

export function collectRosterStrategyEvidence(
  runs: readonly SimulationRun[],
): RosterStrategyEvidenceReport {
  const missingMetadata = getMissingStatPrerequisiteMetadataDefinitionIds();

  if (missingMetadata.length > 0) {
    throw new Error(
      "Phase 2 cannot audit every stat-gated definition because typed " +
        "Phase 1B stat prerequisites are missing for: " +
        missingMetadata.join(", ") +
        ".",
    );
  }

  const perGame = runs
    .map(createPerGameEvidence)
    .sort(
      (first, second) =>
        first.gameSize.localeCompare(second.gameSize) || first.seed.localeCompare(second.seed),
    );
  const statGatedSelections = createStatGatedSelectionEvidence(runs);

  return {
    perGame,
    gameSizeSummaries: createGameSizeSummaries(perGame),
    statGatedSelections,
    focusedDefinitions: createFocusedDefinitionMetrics({
      runs,
      perGame,
    }),
  };
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

function formatThreshold(comparison: "eq" | "gte" | "lte", threshold: TributeStatValue): string {
  const operator = comparison === "eq" ? "=" : comparison === "gte" ? "≥" : "≤";

  return `${operator} ${threshold}`;
}

function sanitizeTsv(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

export function createRosterStrategyEvidenceMarkdown(
  report: RosterStrategyEvidenceReport,
): string[] {
  const lines: string[] = [
    "## Roster and Bloodbath strategy evidence",
    "",
    "This section separates initial roster composition, deterministic Day 1 strategy assignment, selector hard feasibility, weighted-pool exposure, and final selection. Strategy assignments are replayed with the production Bloodbath strategy function and the same Day 1 round seed; the replay does not alter simulation state.",
    "",
  ];

  for (const summary of report.gameSizeSummaries) {
    const label = summary.gameSize === "half-game" ? "Half Game" : "Full Game";

    lines.push(
      `### ${label} initial roster composition`,
      "",
      `Games: ${summary.games}; tributes per game: ${summary.tributeCountPerGame}.`,
      "",
      "| Stat | 1 | 2 | 3 | 4 | 5 |",
      "| --- | ---: | ---: | ---: | ---: | ---: |",
      ...AUDIT_TRIBUTE_STATS.map(
        (stat) =>
          `| ${stat[0]?.toUpperCase()}${stat.slice(1)} | ` +
          AUDIT_STAT_VALUES.map((value) =>
            formatNumber(summary.averageRosterStatCounts[stat][value]),
          ).join(" | ") +
          " |",
      ),
      "",
      `### ${label} Cornucopia-versus-Flee strategy by stat value`,
      "",
      "| Stat | Value | Roster assignments | Avg. roster/game | Cornucopia | Flee | Cornucopia rate |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...summary.strategyByStatValue.map(
        (metric) =>
          `| ${metric.stat} | ${metric.value} | ${metric.rosterCount} | ` +
          `${formatNumber(metric.averageRosterCountPerGame)} | ` +
          `${metric.cornucopiaAssignments} | ${metric.fleeAssignments} | ` +
          `${formatRate(metric.cornucopiaRate)} |`,
      ),
      "",
    );
  }

  lines.push(
    "### Focused Cornucopia stat-gated definitions",
    "",
    "Roster candidates satisfy the typed Phase 1B stat prerequisite before strategy assignment. Hard feasibility and weighted-pool exposure come from recorded selector opportunity rows.",
    "",
    "| Game size | Definition | Typed gate | Avg. roster candidates | Roster presence | Candidate Cornucopia rate | Hard-feasible games | Hard-feasible opps | Weighted-pool games | Weighted entries | Selected games | Accepted | Hard→weighted | Weighted-entry→selected | Hard→selected |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.focusedDefinitions.map(
      (metric) =>
        `| ${metric.gameSize} | \`${metric.definitionId}\` | ` +
        `${metric.roleId} ${metric.stat} ${formatThreshold(
          metric.comparison,
          metric.authoredThreshold,
        )} (${metric.valueSource}) | ` +
        `${formatNumber(metric.averageRosterCandidatesPerGame)} | ` +
        `${formatRate(metric.rosterPresenceRate)} | ` +
        `${formatRate(metric.candidateCornucopiaRate)} | ` +
        `${metric.hardFeasibleGames} | ${metric.hardFeasibleOpportunities} | ` +
        `${metric.weightedPoolGames} | ${metric.weightedPoolEntries} | ` +
        `${metric.selectedGames} | ${metric.acceptedSelections} | ` +
        `${formatRate(metric.hardFeasibleToWeightedPoolConversion)} | ` +
        `${formatRate(metric.weightedPoolEntryToSelectionConversion)} | ` +
        `${formatRate(metric.hardFeasibleToSelectionConversion)} |`,
    ),
    "",
    "### Selected stat-gated participant evidence",
    "",
    `Recorded ${report.statGatedSelections.length} satisfied typed stat-condition row(s) across selected stat-gated participant roles.`,
    "",
    "For OR-gated callbacks, only the alternative condition(s) actually satisfied by the selected tribute are emitted. Detailed role, threshold, base/effective source, selected value, and Bloodbath strategy evidence is written to `event-frequency-stat-gated-selections.tsv`.",
    "",
  );

  return lines;
}

export function createRosterStatsByGameTsv(report: RosterStrategyEvidenceReport): string {
  const countColumns = AUDIT_TRIBUTE_STATS.flatMap((stat) =>
    AUDIT_STAT_VALUES.map((value) => `${stat}_${value}`),
  );
  const header = ["seed", "game_size", "tribute_count", ...countColumns];
  const rows = report.perGame.map((game) =>
    [
      game.seed,
      game.gameSize,
      game.tributeCount,
      ...AUDIT_TRIBUTE_STATS.flatMap((stat) =>
        AUDIT_STAT_VALUES.map((value) => game.rosterStatCounts[stat][value]),
      ),
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createBloodbathStrategyByGameTsv(report: RosterStrategyEvidenceReport): string {
  const header = [
    "seed",
    "game_size",
    "tribute_id",
    "source_definition_id",
    "brains",
    "brawn",
    "luck",
    "strategy",
  ];
  const rows = report.perGame.flatMap((game) =>
    game.strategyAssignments.map((assignment) =>
      [
        game.seed,
        game.gameSize,
        assignment.tributeId,
        assignment.sourceDefinitionId ?? "",
        assignment.stats.brains,
        assignment.stats.brawn,
        assignment.stats.luck,
        assignment.strategy,
      ]
        .map((value) => sanitizeTsv(String(value)))
        .join("\t"),
    ),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createBloodbathStrategyByStatTsv(report: RosterStrategyEvidenceReport): string {
  const header = [
    "game_size",
    "games",
    "stat",
    "value",
    "roster_count",
    "average_roster_count_per_game",
    "cornucopia_assignments",
    "flee_assignments",
    "cornucopia_rate",
  ];
  const rows = report.gameSizeSummaries.flatMap((summary) =>
    summary.strategyByStatValue.map((metric) =>
      [
        summary.gameSize,
        summary.games,
        metric.stat,
        metric.value,
        metric.rosterCount,
        metric.averageRosterCountPerGame,
        metric.cornucopiaAssignments,
        metric.fleeAssignments,
        metric.cornucopiaRate,
      ]
        .map((value) => sanitizeTsv(String(value)))
        .join("\t"),
    ),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createStatGatedSelectionTsv(report: RosterStrategyEvidenceReport): string {
  const header = [
    "seed",
    "game_size",
    "pool",
    "definition_id",
    "resolved_event_id",
    "role_id",
    "participant_tribute_id",
    "participant_name",
    "gate_mode",
    "stat",
    "comparison",
    "authored_threshold",
    "value_source",
    "selected_stat_value",
    "satisfies_authored_threshold",
    "bloodbath_strategy",
  ];
  const rows = report.statGatedSelections.map((row) =>
    [
      row.seed,
      row.gameSize,
      row.poolId,
      row.definitionId,
      row.resolvedEventId,
      row.roleId,
      row.participantTributeId,
      row.participantName,
      row.gateMode,
      row.stat,
      row.comparison,
      row.authoredThreshold,
      row.valueSource,
      row.selectedStatValue,
      row.satisfiesAuthoredThreshold,
      row.bloodbathStrategy ?? "",
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}

export function createFocusedStatGateTsv(report: RosterStrategyEvidenceReport): string {
  const header = [
    "game_size",
    "definition_id",
    "role_id",
    "stat",
    "comparison",
    "authored_threshold",
    "value_source",
    "games",
    "games_with_roster_candidate",
    "roster_presence_rate",
    "total_roster_candidates",
    "average_roster_candidates_per_game",
    "cornucopia_candidate_assignments",
    "flee_candidate_assignments",
    "candidate_cornucopia_rate",
    "hard_feasible_games",
    "hard_feasible_opportunities",
    "weighted_pool_games",
    "weighted_pool_opportunities",
    "weighted_pool_entries",
    "selected_games",
    "accepted_selections",
    "hard_feasible_to_weighted_pool_conversion",
    "weighted_pool_entry_to_selection_conversion",
    "hard_feasible_to_selection_conversion",
  ];
  const rows = report.focusedDefinitions.map((metric) =>
    [
      metric.gameSize,
      metric.definitionId,
      metric.roleId,
      metric.stat,
      metric.comparison,
      metric.authoredThreshold,
      metric.valueSource,
      metric.games,
      metric.gamesWithRosterCandidate,
      metric.rosterPresenceRate,
      metric.totalRosterCandidates,
      metric.averageRosterCandidatesPerGame,
      metric.cornucopiaCandidateAssignments,
      metric.fleeCandidateAssignments,
      metric.candidateCornucopiaRate,
      metric.hardFeasibleGames,
      metric.hardFeasibleOpportunities,
      metric.weightedPoolGames,
      metric.weightedPoolOpportunities,
      metric.weightedPoolEntries,
      metric.selectedGames,
      metric.acceptedSelections,
      metric.hardFeasibleToWeightedPoolConversion,
      metric.weightedPoolEntryToSelectionConversion,
      metric.hardFeasibleToSelectionConversion,
    ]
      .map((value) => sanitizeTsv(String(value)))
      .join("\t"),
  );

  return `${[header.join("\t"), ...rows].join("\n")}\n`;
}
