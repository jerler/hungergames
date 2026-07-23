import type { EventCategory, EventTag } from "~/game/events/event-schema";
import type { AuthoredRequirement } from "~/game/events/authoring/requirements/requirement-schema";
import type { AuthoredRoleOptions } from "~/game/events/authoring/roles/role-schema";
import type { RoundReference } from "~/game/types/game-state";

export interface EventFamilyMetadata {
  category?: EventCategory;
  tags?: readonly EventTag[];
  periods?: readonly RoundReference["period"][];
  weight?: number;
  roleOptions?: AuthoredRoleOptions;
  requirements?: readonly AuthoredRequirement[];
}

export function mergeEventTags(
  requiredTags: readonly EventTag[],
  additionalTags: readonly EventTag[] = [],
): EventTag[] {
  return [...new Set([...requiredTags, ...additionalTags])];
}
