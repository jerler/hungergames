import type { EventDefinition } from "~/game/events/event-schema";

import { validateEventDefinition } from "~/game/events/validation/validate-event-definition";

export interface EventCatalogueFamily {
  name: string;
  events: readonly EventDefinition[];
}

export interface EventCatalogueValidationOptions {
  ordinaryCatalogue: readonly EventDefinition[];
  bloodbathCatalogue: readonly EventDefinition[];

  ordinaryFamilies: readonly EventCatalogueFamily[];
  bloodbathFamilies: readonly EventCatalogueFamily[];
}

function validateUniqueIds(label: string, events: readonly EventDefinition[]): void {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.id, (counts.get(event.id) ?? 0) + 1);
  }

  const duplicateIds = [...counts].filter(([, count]) => count > 1).map(([eventId]) => eventId);

  if (duplicateIds.length > 0) {
    throw new Error(`${label} contains duplicate event IDs: ${duplicateIds.join(", ")}.`);
  }
}

function validateFamilyCoverage(
  label: string,
  catalogue: readonly EventDefinition[],
  families: readonly EventCatalogueFamily[],
): void {
  const exportedEvents = families.flatMap(({ events }) => [...events]);

  validateUniqueIds(`${label} exported families`, exportedEvents);

  if (catalogue.length !== exportedEvents.length) {
    throw new Error(
      `${label} contains ${catalogue.length} events but its exported families contain ${exportedEvents.length}.`,
    );
  }

  for (const event of exportedEvents) {
    const exactMatches = catalogue.filter((candidate) => candidate === event);

    if (exactMatches.length !== 1) {
      throw new Error(`${label} must include exported event "${event.id}" exactly once.`);
    }
  }

  for (const event of catalogue) {
    const exactMatches = exportedEvents.filter((candidate) => candidate === event);

    if (exactMatches.length !== 1) {
      throw new Error(
        `${label} contains event "${event.id}" that is not exported by exactly one registered family.`,
      );
    }
  }
}

export function validateEventCatalogues({
  ordinaryCatalogue,
  bloodbathCatalogue,
  ordinaryFamilies,
  bloodbathFamilies,
}: EventCatalogueValidationOptions): void {
  for (const definition of [...ordinaryCatalogue, ...bloodbathCatalogue]) {
    validateEventDefinition(definition);
  }

  validateUniqueIds("Ordinary event catalogue", ordinaryCatalogue);

  validateUniqueIds("Bloodbath event catalogue", bloodbathCatalogue);

  const ordinaryIds = new Set(ordinaryCatalogue.map((event) => event.id));

  const overlappingIds = bloodbathCatalogue
    .map((event) => event.id)
    .filter((eventId) => ordinaryIds.has(eventId));

  if (overlappingIds.length > 0) {
    throw new Error(
      `Bloodbath events must not appear in the ordinary catalogue: ${overlappingIds.join(", ")}.`,
    );
  }

  validateFamilyCoverage("Ordinary event catalogue", ordinaryCatalogue, ordinaryFamilies);

  validateFamilyCoverage("Bloodbath event catalogue", bloodbathCatalogue, bloodbathFamilies);
}
