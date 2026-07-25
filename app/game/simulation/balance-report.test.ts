import { describe, expect, it } from "vitest";

import { evaluateBalanceGuardrails } from "./balance-guardrails";

import { collectBalanceMetrics } from "./balance-metrics";

import { createBalanceReport } from "./balance-report";

import { simulateGameBatch } from "./simulation-runner";

describe("balance report", () => {
  it("formats the collected metrics as Markdown", () => {
    const metrics = collectBalanceMetrics(
      simulateGameBatch([
        {
          seedPrefix: "report-half",

          count: 1,

          districtCount: 6,
        },

        {
          seedPrefix: "report-full",

          count: 1,

          districtCount: 12,
        },
      ]),
    );

    const report = createBalanceReport(
      metrics,

      evaluateBalanceGuardrails(metrics),
    );

    expect(report).toContain("# Status and Inventory Balance Report");

    expect(report).toContain("## Game length");

    expect(report).toContain("## Combat");

    expect(report).toContain("## Inventory");

    expect(report).toContain("## Victor stat balance");
  });
});
