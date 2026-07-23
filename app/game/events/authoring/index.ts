/* Event builder */

export { createEvent } from "./builder/create-event";

/* Participant roles */

export {
  attackerRole,
  foragerRole,
  groupRole,
  opposedTargetRole,
  soloRole,
  victimRole,
} from "./roles/role-presets";

export type {
  AuthoredRoleOptions,
  AuthoredRoleSpecification,
  RoleWeight,
} from "./roles/role-schema";

/* Eligibility requirements */

export { hasAnyHarmfulStatus, hasStatus, lacksStatus } from "./requirements/status-requirements";

export { maximumStat, minimumStat } from "./requirements/stat-requirements";

export { inActiveTruce, notInSameTruce } from "./requirements/relationship-requirements";

export type {
  AuthoredRequirement,
  HasAnyHarmfulStatusRequirement,
  HasStatusRequirement,
  InActiveTruceRequirement,
  LacksStatusRequirement,
  MaximumStatRequirement,
  MinimumStatRequirement,
  NotInSameTruceRequirement,
  RelationshipRequirement,
  RequirementStat,
  StatRequirement,
  HasItemRequirement,
  HasItemTagRequirement,
  HasTreatmentForRequirement,
  ItemRequirement,
  RequiredItemAccess,
  StatusRequirement,
} from "./requirements/requirement-schema";

/* Stat checks */

export { brains, brawn, luck } from "./checks/stat-checks";

/* Effects */

export { applyStatus } from "./effects/status-effects";
export { survived } from "./effects/statistic-effects";

/* Outcomes */

export { result } from "./outcomes/result";

/* Resolution strategies */

export { always } from "./strategies/always";
export { statCheck } from "./strategies/stat-check";

/* Event text characters */

export type { EventCharacter, EventPronouns } from "./characters/event-character";

export type { EventText, EventTextContext } from "./characters/event-text-context";

export { hasItem, hasItemTag, hasTreatmentFor } from "./requirements/item-requirements";

export type {
  HasItemOptions,
  HasItemTagOptions,
  HasTreatmentForOptions,
} from "./requirements/item-requirements";

export { consumeRequiredItem, recordRequiredItemUse } from "./effects/required-item-effects";

export type { RequiredItemEffectOptions } from "./effects/required-item-effects";

export { acquireNaturalResource } from "./effects/natural-resource-effects";
export { randomResult } from "./outcomes/random-result";

/* Event families */

export { createNaturalResourceEvent } from "./families/natural-resource-event";
export type {
  NaturalResourceEventOptions,
  NaturalResourceEventText,
} from "./families/natural-resource-event";

export { createSoloStatEvent } from "./families/solo-stat-event";
export type { SoloStatEventOptions } from "./families/solo-stat-event";

export { createItemStatEvent } from "./families/item-stat-event";
export type { ItemStatEventOptions } from "./families/item-stat-event";

export type { EventFamilyMetadata } from "./families/family-types";
export type { StatOutcomeKey } from "./families/family-outcomes";
