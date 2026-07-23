import { EventBuilder } from "./event-builder";

export function createEvent(id: string): EventBuilder {
  return new EventBuilder({
    id,

    category: "survival",

    tags: [],

    periods: [],

    baseWeight: 1,

    roles: [],
  });
}
