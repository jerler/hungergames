import type { EventResult } from "./outcome-schema";

export interface EventResultOptions extends Omit<EventResult, "effects"> {
  effects?: EventResult["effects"];
}

export function result({ text, append, effects = [] }: EventResultOptions): EventResult {
  if (text !== undefined && append !== undefined) {
    throw new Error('An event result cannot define both "text" and "append".');
  }

  return {
    text,
    append,
    effects: [...effects],
  };
}
