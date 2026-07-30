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

    expect(report).toContain("### Rest quality");
    expect(report).toContain("Total recorded outcomes");

    expect(report).toContain("## Food, water, and deprivation");
    expect(report).toContain("Hunger eligibility opportunities");
    expect(report).toContain("## Inventory");

    expect(report).toContain("## Victor stat balance");
  });

  it("treats deliberately rare romantic events as informational", () => {
    const metrics = collectBalanceMetrics(
      simulateGameBatch([
        {
          seedPrefix: "informational-family-half",
          count: 1,
          districtCount: 6,
        },
        {
          seedPrefix: "informational-family-full",
          count: 1,
          districtCount: 12,
        },
      ]),
    );
    const romanticFamily = metrics.eventFamilies.find(
      (family) => family.id === "ordinary:romantic",
    );

    expect(romanticFamily).toBeDefined();

    const metricsWithoutRomanticSelections = {
      ...metrics,
      eventFamilies: metrics.eventFamilies.map((family) =>
        family.id === "ordinary:romantic"
          ? {
              ...family,
              eventCount: 0,
              gamesWithEvent: 0,
              eventsPerGame: 0,
            }
          : family,
      ),
    };

    expect(
      evaluateBalanceGuardrails(metricsWithoutRomanticSelections).find(
        (guardrail) => guardrail.id === "family:ordinary:romantic",
      ),
    ).toBeUndefined();
  });
});
