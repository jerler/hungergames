import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { collectEventDistributionMetrics } from "~/game/simulation/event-distribution-metrics";

import { createEventDistributionReport } from "~/game/simulation/event-distribution-report";

import { simulateGameBatch } from "~/game/simulation/simulation-runner";

const DEFAULT_HALF_GAMES = 200;
const DEFAULT_FULL_GAMES = 100;
const DEFAULT_SEED_PREFIX = "event-distribution";
const DEFAULT_OUTPUT_DIRECTORY = "reports";

interface ReportConfiguration {
  halfGames: number;
  fullGames: number;
  seedPrefix: string;
  outputDirectory: string;
}

function readOption(name: string): string | undefined {
  const exactPrefix = `--${name}=`;
  const exactArgument = process.argv.slice(2).find((argument) => argument.startsWith(exactPrefix));

  if (exactArgument) {
    return exactArgument.slice(exactPrefix.length);
  }

  const argumentIndex = process.argv.slice(2).findIndex((argument) => argument === `--${name}`);

  if (argumentIndex < 0) {
    return undefined;
  }

  return process.argv.slice(2)[argumentIndex + 1];
}

function parseGameCount(name: string, fallback: number): number {
  const rawValue = readOption(name);

  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }

  return value;
}

function getConfiguration(): ReportConfiguration {
  const configuration = {
    halfGames: parseGameCount("half-games", DEFAULT_HALF_GAMES),
    fullGames: parseGameCount("full-games", DEFAULT_FULL_GAMES),
    seedPrefix: readOption("seed-prefix") ?? DEFAULT_SEED_PREFIX,
    outputDirectory: readOption("output-directory") ?? DEFAULT_OUTPUT_DIRECTORY,
  };

  if (configuration.halfGames + configuration.fullGames === 0) {
    throw new Error("At least one Half Game or Full Game must be requested.");
  }

  if (configuration.seedPrefix.trim().length === 0) {
    throw new Error("--seed-prefix must not be empty.");
  }

  if (configuration.outputDirectory.trim().length === 0) {
    throw new Error("--output-directory must not be empty.");
  }

  return configuration;
}

function printHelp(): void {
  console.log(`Usage: npm run event-distribution -- [options]

Options:
  --half-games <count>       Half Games to simulate (default: 200)
  --full-games <count>       Full Games to simulate (default: 100)
  --seed-prefix <prefix>     Deterministic seed prefix
  --output-directory <path>  Report directory (default: reports)
  --help                     Show this help
`);
}

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

const configuration = getConfiguration();

const batchDefinitions = [
  ...(configuration.halfGames > 0
    ? [
        {
          seedPrefix: `${configuration.seedPrefix}-half-game`,
          count: configuration.halfGames,
          districtCount: 6 as const,
          captureSelectionDiagnostics: true,
        },
      ]
    : []),
  ...(configuration.fullGames > 0
    ? [
        {
          seedPrefix: `${configuration.seedPrefix}-full-game`,
          count: configuration.fullGames,
          districtCount: 12 as const,
          captureSelectionDiagnostics: true,
        },
      ]
    : []),
];

const runs = simulateGameBatch(batchDefinitions);
const metrics = collectEventDistributionMetrics(runs);
const report = createEventDistributionReport(metrics);

const outputDirectory = resolve(process.cwd(), configuration.outputDirectory);
const markdownPath = resolve(outputDirectory, "event-distribution-report.md");
const jsonPath = resolve(outputDirectory, "event-distribution-report.json");

await mkdir(outputDirectory, {
  recursive: true,
});

await Promise.all([
  writeFile(markdownPath, report, "utf8"),
  writeFile(
    jsonPath,
    `${JSON.stringify(
      {
        configuration,
        metrics,
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
]);

console.log(`Event-distribution Markdown written to ${markdownPath}`);
console.log(`Event-distribution JSON written to ${jsonPath}`);
console.log(
  `Simulated ${metrics.sample.halfGames} Half Games and ${metrics.sample.fullGames} Full Games.`,
);

for (const gameSize of Object.values(metrics.gameSizes)) {
  if (gameSize.games === 0) {
    continue;
  }

  const cornucopia = gameSize.pools["bloodbath-cornucopia"];
  const fleeing = gameSize.pools["bloodbath-flee"];
  const laterDay = gameSize.pools["later-day"];

  console.log(
    `${gameSize.label}: Day 1 Cornucopia non-solo ${(cornucopia.nonSoloShare * 100).toFixed(
      1,
    )}%; fleeing non-solo ${(fleeing.nonSoloShare * 100).toFixed(1)}%; Day 2+ non-solo ${(
      laterDay.nonSoloShare * 100
    ).toFixed(1)}%.`,
  );
}
