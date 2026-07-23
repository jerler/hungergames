import { createEvent } from "~/game/events/authoring/builder/create-event";
import type { AuthoredStatCheck } from "~/game/events/authoring/checks/check-schema";
import type { StatCheckResults } from "~/game/events/authoring/outcomes/outcome-schema";
import { soloRole } from "~/game/events/authoring/roles/role-presets";
import { statCheck } from "~/game/events/authoring/strategies/stat-check";
import type { EventDefinition } from "~/game/events/event-schema";

import type { EventFamilyMetadata } from "./family-types";
import { mergeEventTags } from "./family-types";

export interface SoloStatEventOptions extends EventFamilyMetadata {
  check: AuthoredStatCheck;
  outcomes: StatCheckResults;
  roleId?: string;
}

export function createSoloStatEvent(
  id: string,
  {
    check,
    outcomes,
    roleId = "tribute",

    category = "hazard",
    tags = [],
    periods = ["day", "night"],
    weight = 1,
    roleOptions = {},
    requirements = [],
  }: SoloStatEventOptions,
): EventDefinition {
  return createEvent(id)
    .roles(soloRole(roleId, roleOptions))
    .when(...requirements)
    .category(category)
    .tags(...mergeEventTags([category], tags))
    .during(...periods)
    .weight(weight)
    .resolve(statCheck(roleId, check, outcomes));
}
