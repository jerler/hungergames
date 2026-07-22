import { describe, expect, it } from "vitest";

import { BLOODBATH_EVENT_CATALOGUE } from "./bloodbath";
import { ENCOUNTER_EVENTS, THEFT_EVENTS } from "./encounters";
import { RELATIONSHIP_EVENTS } from "./relationships";
import { STANDARD_INTERACTION_EVENTS } from "./relationships/standard-interaction-events";

import { EVENT_CATALOGUE } from "./index";

describe("event catalogue", () => {
  it("contains every event definition exactly once", () => {
    const eventIds = EVENT_CATALOGUE.map((event) => event.id);

    const duplicateIds = eventIds.filter((eventId, index) => eventIds.indexOf(eventId) !== index);

    expect(duplicateIds).toEqual([]);
  });

  it("includes theft in the ordinary encounter catalogue", () => {
    const encounterIds = new Set(ENCOUNTER_EVENTS.map((event) => event.id));

    const ordinaryIds = new Set(EVENT_CATALOGUE.map((event) => event.id));

    expect(THEFT_EVENTS.length).toBeGreaterThan(0);

    for (const theftEvent of THEFT_EVENTS) {
      expect(encounterIds.has(theftEvent.id)).toBe(true);

      expect(ordinaryIds.has(theftEvent.id)).toBe(true);
    }
  });

  it("keeps theft outside the Bloodbath catalogue", () => {
    const bloodbathIds = new Set(BLOODBATH_EVENT_CATALOGUE.map((event) => event.id));

    for (const theftEvent of THEFT_EVENTS) {
      expect(bloodbathIds.has(theftEvent.id)).toBe(false);
    }
  });

  it("keeps theft outside relationship and truce-betrayal events", () => {
    const relationshipIds = new Set(RELATIONSHIP_EVENTS.map((event) => event.id));

    const betrayalIds = new Set(
      STANDARD_INTERACTION_EVENTS.filter((event) => event.id.startsWith("truce-betrayal-")).map(
        (event) => event.id,
      ),
    );

    /*
     * Guard against this test silently passing if the
     * betrayal family is renamed or removed.
     */
    expect(betrayalIds.size).toBeGreaterThan(0);

    for (const theftEvent of THEFT_EVENTS) {
      expect(relationshipIds.has(theftEvent.id)).toBe(false);

      expect(betrayalIds.has(theftEvent.id)).toBe(false);
    }
  });

  it("configures theft for ordinary day and night rounds", () => {
    for (const theftEvent of THEFT_EVENTS) {
      expect(theftEvent.periods).toEqual(["day", "night"]);
    }
  });
});
