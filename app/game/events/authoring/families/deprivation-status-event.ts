import { createEvent } from "~/game/events/authoring/builder/create-event";
import type { EventText } from "~/game/events/authoring/characters/event-text-context";
import { applyStatus } from "~/game/events/authoring/effects/status-effects";
import { survived } from "~/game/events/authoring/effects/statistic-effects";
import { randomResult } from "~/game/events/authoring/outcomes/random-result";
import { result } from "~/game/events/authoring/outcomes/result";
import {
  isHungerStatusEligible,
  isThirstStatusEligible,
} from "~/game/events/authoring/requirements/status-requirements";
import { soloRole } from "~/game/events/authoring/roles/role-presets";
import { always } from "~/game/events/authoring/strategies/always";
import type { EventDefinition } from "~/game/events/event-schema";
import type { SurvivalNeed } from "~/game/survival/survival-schema";

import { mergeEventTags, type EventFamilyMetadata } from "./family-types";

export interface DeprivationStatusEventOptions extends Omit<EventFamilyMetadata, "category"> {
  need: SurvivalNeed;
  texts: readonly EventText[];
  roleId?: string;
}

export function createDeprivationStatusEvent(
  id: string,
  {
    need,
    texts,
    roleId = "tribute",
    periods = ["day", "night"],
    weight = need === "water" ? 12 : 10,
    tags = [],
    roleOptions = {},
    requirements = [],
  }: DeprivationStatusEventOptions,
): EventDefinition {
  if (texts.length < 2) {
    throw new Error(`Deprivation event "${id}" requires at least two text variants.`);
  }

  const statusId = need === "food" ? "hungry" : "thirsty";

  const eligibility =
    need === "food" ? isHungerStatusEligible(roleId) : isThirstStatusEligible(roleId);

  return createEvent(id)
    .roles(soloRole(roleId, roleOptions))
    .when(eligibility, ...requirements)
    .category("survival")
    .tags(...mergeEventTags(["survival", "status", "deprivation"], tags))
    .during(...periods)
    .weight(weight)
    .weightMultiplier(({ round }) => (round.period === "night" ? 0.2 : 1))
    .resolve(
      always(
        randomResult(
          ...texts.map((text) =>
            result({
              text,
              effects: [applyStatus(roleId, statusId, 1), survived(roleId)],
            }),
          ),
        ),
      ),
    );
}
