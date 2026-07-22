import { CORNUCOPIA_ACQUISITION_EVENTS } from
  "./cornucopia-acquisition-events";
import { CORNUCOPIA_CONFLICT_EVENTS } from
  "./cornucopia-conflict-events";
import { FLEE_EVENTS } from "./flee-events";

export {
  CORNUCOPIA_ACQUISITION_EVENTS,
  CORNUCOPIA_CONFLICT_EVENTS,
  FLEE_EVENTS,
};

export const CORNUCOPIA_EVENTS = [
  ...CORNUCOPIA_ACQUISITION_EVENTS,
  ...CORNUCOPIA_CONFLICT_EVENTS,
] as const;

export const BLOODBATH_EVENT_CATALOGUE = [
  ...CORNUCOPIA_EVENTS,
  ...FLEE_EVENTS,
] as const;