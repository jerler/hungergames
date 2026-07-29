import { createEvent } from "~/game/events/authoring/builder/create-event";
import type { EventTextContext } from "~/game/events/authoring/characters/event-text-context";
import { satisfySurvivalNeed } from "~/game/events/authoring/effects/survival-effects";
import { survived } from "~/game/events/authoring/effects/statistic-effects";
import { randomResult } from "~/game/events/authoring/outcomes/random-result";
import { result } from "~/game/events/authoring/outcomes/result";
import { foragerRole } from "~/game/events/authoring/roles/role-presets";
import type { AuthoredRoleOptions } from "~/game/events/authoring/roles/role-schema";
import { always } from "~/game/events/authoring/strategies/always";
import type { EventDefinition } from "~/game/events/event-schema";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

import { mergeEventTags, type EventFamilyMetadata } from "./family-types";

export type ImmediateResourceEventText = (context: EventTextContext, need: SurvivalNeed) => string;

export interface ImmediateResourceEventOptions extends Omit<EventFamilyMetadata, "category"> {
  needs: readonly SurvivalNeed[];
  text: ImmediateResourceEventText;
  roleId?: string;
  roleOptions?: AuthoredRoleOptions;
}

export function createImmediateResourceEvent(
  id: string,
  {
    needs,
    text,
    roleId = "tribute",
    roleOptions = {},
    periods = ["day"],
    weight = 8,
    tags = [],
    requirements = [],
    recoveryTargets = [],
  }: ImmediateResourceEventOptions,
): EventDefinition {
  if (needs.length === 0) {
    throw new Error(`Immediate-resource event "${id}" requires at least one need.`);
  }

  const results = needs.map((need) =>
    result({
      text: (context) => text(context, need),
      effects: [satisfySurvivalNeed(roleId, need), survived(roleId)],
    }),
  );

  const outcome = results.length === 1 ? results[0] : randomResult(...results);

  return createEvent(id)
    .roles(foragerRole(roleId, roleOptions))
    .when(...requirements)
    .category("survival")
    .tags(...mergeEventTags(["survival", "resource"], tags))
    .during(...periods)
    .weight(weight)
    .addresses(
      ...needs.map((need) => ({
        kind: "survival-need" as const,
        roleId,
        need,
      })),
      ...recoveryTargets,
    )
    .resolve(always(outcome));
}
