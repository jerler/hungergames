import type {
  EventCategory,
  EventResolution,
  EventResolutionContext,
  EventTag,
  ParticipantRoleDefinition,
} from "~/game/events/event-schema";
import type { RoundReference } from "~/game/types/game-state";

export interface AuthoredEventConfiguration {
  id: string;
  category: EventCategory;
  tags: readonly EventTag[];
  periods: readonly RoundReference["period"][];
  baseWeight: number;
  roles: readonly ParticipantRoleDefinition[];
}

export interface SoloRoleOptions {
  isEligible?: ParticipantRoleDefinition["isEligible"];

  getWeight?: ParticipantRoleDefinition["getWeight"];
}

export interface EventResolutionStrategy {
  validate(eventId: string, roleIds: readonly string[]): void;

  resolve(context: EventResolutionContext, roleIds: readonly string[]): EventResolution;
}
