import { describe, expect, it } from "vitest";

import { STATUS_CATALOGUE, getStatusDefinition } from "./status-catalogue";
import type { StatusEffectId } from "./status-schema";

const EXPECTED_STATUS_IDS = [
  "injured",
  "bleeding",
  "parched",
  "dehydrated",
  "hungry",
  "starving",
  "exhausted",
  "disoriented",
  "poisoned",
  "burned",
  "hidden",
  "well-fed",
  "well-rested",
  "alert",
  "lucky",
  "hunted",
  "inspired",
] satisfies readonly StatusEffectId[];

describe("status catalogue", () => {
  it("contains every planned status", () => {
    expect(STATUS_CATALOGUE.map((status) => status.id)).toEqual(EXPECTED_STATUS_IDS);
  });

  it("contains unique status IDs", () => {
    const statusIds = STATUS_CATALOGUE.map((status) => status.id);

    expect(new Set(statusIds).size).toBe(statusIds.length);
  });

  it("contains the expected fatal timed statuses", () => {
    const statuses = STATUS_CATALOGUE.filter(
      (status) => status.duration.kind === "timed" && status.duration.expiration === "fatal",
    );

    expect(statuses.map((status) => status.id)).toEqual([
      "bleeding",
      "dehydrated",
      "starving",
      "poisoned",
    ]);
  });

  it("contains the expected recovering harmful statuses", () => {
    const statuses = STATUS_CATALOGUE.filter(
      (status) =>
        status.kind === "harmful" &&
        status.duration.kind === "timed" &&
        status.duration.expiration === "recover",
    );

    expect(statuses.map((status) => status.id)).toEqual([
      "injured",
      "exhausted",
      "disoriented",
      "burned",
      "hunted",
    ]);
  });

  it("contains the expected persistent statuses", () => {
    const statuses = STATUS_CATALOGUE.filter((status) => status.duration.kind === "persistent");

    expect(statuses.map((status) => status.id)).toEqual(["parched", "hungry"]);
  });

  it("contains the expected beneficial statuses", () => {
    const statuses = STATUS_CATALOGUE.filter((status) => status.kind === "beneficial");

    expect(statuses.map((status) => status.id)).toEqual([
      "hidden",
      "well-fed",
      "well-rested",
      "alert",
      "lucky",
      "inspired",
    ]);
  });

  it.each(EXPECTED_STATUS_IDS)("resolves the %s definition", (statusId) => {
    expect(getStatusDefinition(statusId).id).toBe(statusId);
  });

  it("gives every timed status a positive default duration", () => {
    for (const status of STATUS_CATALOGUE) {
      if (status.duration.kind === "persistent") {
        continue;
      }

      expect(Number.isInteger(status.duration.defaultRounds)).toBe(true);

      expect(status.duration.defaultRounds).toBeGreaterThan(0);
    }
  });

  it("only gives fatality copy to fatal statuses", () => {
    for (const status of STATUS_CATALOGUE) {
      const isFatal = status.duration.kind === "timed" && status.duration.expiration === "fatal";

      if (isFatal) {
        expect(status).toMatchObject({
          fatalCauseLabel: expect.any(String),
          fatalSummary: expect.any(String),
        });

        continue;
      }

      expect("fatalCauseLabel" in status).toBe(false);
      expect("fatalSummary" in status).toBe(false);
    }
  });

  it("only gives removal instructions to persistent statuses", () => {
    for (const status of STATUS_CATALOGUE) {
      if (status.duration.kind === "persistent") {
        expect(status).toMatchObject({
          removalDescription: expect.any(String),
        });

        continue;
      }

      expect("removalDescription" in status).toBe(false);
    }
  });

  it("makes injuries and burns recovering statuses", () => {
    for (const statusId of ["injured", "burned"] as const) {
      expect(getStatusDefinition(statusId).duration).toMatchObject({
        kind: "timed",
        expiration: "recover",
      });
    }
  });
});
