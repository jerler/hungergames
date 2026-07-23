import type {
  EventCategory,
  EventDefinition,
  EventResolution,
  EventResolutionContext,
  EventTag,
} from "~/game/events/event-schema";
import type { AuthoredRequirement } from "~/game/events/authoring/requirements/requirement-schema";
import type { AuthoredRoleSpecification } from "~/game/events/authoring/roles/role-schema";
import type { RoundReference } from "~/game/types/game-state";

export type EventWeightMultiplier = NonNullable<EventDefinition["getWeightMultiplier"]>;

export interface AuthoredEventConfiguration {
  id: string;

  category: EventCategory;
  tags: readonly EventTag[];

  periods: readonly RoundReference["period"][];
  baseWeight: number;

  getWeightMultiplier?: EventWeightMultiplier;

  roles: readonly AuthoredRoleSpecification[];
  requirements: readonly AuthoredRequirement[];
}

export interface EventResolutionStrategy {
  validate(
    eventId: string,
    roleIds: readonly string[],
    requiredItemRoleIds: readonly string[],
  ): void;

  resolve(context: EventResolutionContext, roleIds: readonly string[]): EventResolution;
}
