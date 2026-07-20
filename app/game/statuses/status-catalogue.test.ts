import { describe, expect, it } from "vitest";

import { STATUS_CATALOGUE, getStatusDefinition } from "./status-catalogue";
import type { StatusEffectId } from "./status-schema";

const EXPECTED_STATUS_IDS = [
  "injured",
  "bleeding",
  "dehydrated",
  "exposed",
  "exhausted",
  "disoriented",
  "sick",
  "poisoned",
  "burned",
  "concealed",
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

  it("contains seven fatal statuses", () => {
    const fatalStatuses = STATUS_CATALOGUE.filter((status) => status.expiration === "fatal");

    expect(fatalStatuses.map((status) => status.id)).toEqual([
      "injured",
      "bleeding",
      "dehydrated",
      "exposed",
      "sick",
      "poisoned",
      "burned",
    ]);
  });

  it("contains three recovering harmful statuses", () => {
    const statuses = STATUS_CATALOGUE.filter(
      (status) => status.expiration === "recover" && status.kind === "harmful",
    );

    expect(statuses.map((status) => status.id)).toEqual(["exhausted", "disoriented", "hunted"]);
  });

  it("contains two beneficial statuses", () => {
    const statuses = STATUS_CATALOGUE.filter((status) => status.kind === "beneficial");

    expect(statuses.map((status) => status.id)).toEqual(["concealed", "inspired"]);
  });

  it.each(EXPECTED_STATUS_IDS)("resolves the %s definition", (statusId) => {
    expect(getStatusDefinition(statusId).id).toBe(statusId);
  });

  it("only gives fatality copy to fatal statuses", () => {
    for (const status of STATUS_CATALOGUE) {
      if (status.expiration === "fatal") {
        expect(status.fatalCauseLabel).toBeTruthy();

        expect(status.fatalSummary).toBeTruthy();

        continue;
      }

      expect("fatalCauseLabel" in status).toBe(false);

      expect("fatalSummary" in status).toBe(false);
    }
  });
});
