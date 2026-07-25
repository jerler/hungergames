import { mkdir, writeFile } from "node:fs/promises";

import { resolve } from "node:path";

import { evaluateBalanceGuardrails } from "~/game/simulation/balance-guardrails";

import { collectBalanceMetrics } from "~/game/simulation/balance-metrics";

import { createBalanceReport } from "~/game/simulation/balance-report";

import { simulateGameBatch } from "~/game/simulation/simulation-runner";

const REPORT_DIRECTORY = resolve(process.cwd(), "reports");

const REPORT_PATH = resolve(REPORT_DIRECTORY, "status-inventory-balance-report.md");

const runs = simulateGameBatch([
  {
    seedPrefix: "balance-half-game",

    count: 200,

    districtCount: 6,
  },

  {
    seedPrefix: "balance-full-game",

    count: 100,

    districtCount: 12,
  },
]);

const metrics = collectBalanceMetrics(runs);

const guardrails = evaluateBalanceGuardrails(metrics);

const report = createBalanceReport(metrics, guardrails);

await mkdir(REPORT_DIRECTORY, {
  recursive: true,
});

await writeFile(REPORT_PATH, report, "utf8");

const failures = guardrails.filter((guardrail) => !guardrail.passed);

console.log(`Balance report written to ${REPORT_PATH}`);

console.log(`${guardrails.length - failures.length}/${guardrails.length} guardrails passed.`);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      `FAIL: ${failure.label} — actual ${failure.actual}; expected ${failure.expected}.`,
    );
  }

  process.exitCode = 1;
}
