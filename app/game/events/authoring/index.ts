export { createPoisonAttackEvent } from "./families/poison-attack-event";
export { createTrapAttackEvent } from "./families/trap-attack-event";

export type {
  TrapAttackEventOptions,
  TrapCriticalFailureStatus,
} from "./families/trap-attack-event";

export { createRiskyAreaAttackEvent } from "./families/risky-area-attack-event";

export type { RiskyAreaAttackEventOptions } from "./families/risky-area-attack-event";
export type { PoisonAttackEventOptions } from "./families/poison-attack-event";

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
  AuthoredOptionalItemSelection,
  AuthoredRoleOptions,
  AuthoredRoleSpecification,
  RoleEligibility,
  RoleItemAccess,
  RoleWeight,
} from "./roles/role-schema";

export { combatRolePair } from "./roles/combat-role-pair";

export type { CombatRolePairOptions } from "./roles/combat-role-pair";

/* Eligibility requirements */

export {
  hasAnyHarmfulStatus,
  hasStatus,
  isHungerStatusEligible,
  isThirstStatusEligible,
  lacksStatus,
} from "./requirements/status-requirements";

export { maximumStat, minimumStat } from "./requirements/stat-requirements";

export { inActiveTruce, notInSameTruce } from "./requirements/relationship-requirements";

export type {
  AuthoredRequirement,
  DeprivationStatusEligibleRequirement,
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
export { ordinaryAttackCheck } from "./checks/combat-check";

export type {
  OrdinaryAttackCheckOptions,
  WeaponAttackCheck,
  WeaponAttackCheckContext,
  WeaponAttackModifier,
  WeaponAttackOutcome,
} from "./checks/combat-check";

/* Effects */

export { applyStatus } from "./effects/status-effects";
export { survived } from "./effects/statistic-effects";
export { recordNightRest, satisfySurvivalNeed } from "./effects/survival-effects";

export { eliminate, kill } from "./effects/fatal-effects";

export type { EliminateOptions, KillOptions } from "./effects/fatal-effects";

export { customResolution } from "./strategies/custom-resolution";

export type {
  CustomEventResolver,
  CustomResolutionHelpers,
  CustomResolutionOptions,
} from "./strategies/custom-resolution";

export { createSelectedRoleItemUseChanges, getSelectedRoleItem } from "./items/selected-role-item";

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

export {
  applyRequiredItemEffects,
  applyRequiredItemRest,
  consumeRequiredItem,
  recordRequiredItemUse,
} from "./effects/required-item-effects";

export type { RequiredItemEffectOptions } from "./effects/required-item-effects";

export { acquirePersistentNaturalResource } from "./effects/natural-resource-effects";
export { randomResult } from "./outcomes/random-result";

/* Event families */

export { createSurvivalNeedTheftEvent } from "./families/survival-need-theft-event";
export type {
  SurvivalNeedTheftEventOptions,
  SurvivalNeedTheftOutcomeTexts,
} from "./families/survival-need-theft-event";

export { createDeprivationStatusEvent } from "./families/deprivation-status-event";
export type { DeprivationStatusEventOptions } from "./families/deprivation-status-event";

export { createImmediateResourceEvent } from "./families/immediate-resource-event";
export type {
  ImmediateResourceEventOptions,
  ImmediateResourceEventText,
} from "./families/immediate-resource-event";
export { createHuntedFoodEvent, HUNTED_FOOD_RESOURCE_IDS } from "./families/hunted-food-event";

export type {
  HuntedFoodEventOptions,
  HuntedFoodEventText,
  HuntedFoodResourceId,
} from "./families/hunted-food-event";

export { createSoloStatEvent } from "./families/solo-stat-event";
export type { SoloStatEventOptions } from "./families/solo-stat-event";

export { createItemStatEvent } from "./families/item-stat-event";
export type { ItemStatEventOptions } from "./families/item-stat-event";

export type { EventFamilyMetadata } from "./families/family-types";

export { createNightRestEvent, NIGHT_REST_ITEM_IDS } from "./families/night-rest-event";

export type {
  NightRestEventOptions,
  NightRestEventOutcome,
  NightRestEventResults,
  NightRestItemId,
  NightRestMethod,
} from "./families/night-rest-event";

export type { StatOutcomeKey } from "./families/family-outcomes";

export { createWeaponAttackEvent } from "./families/weapon-attack-event";

export type { WeaponAttackEventOptions, WeaponUseTiming } from "./families/weapon-attack-event";

export {
  createForageIdentificationEvent,
  HARMFUL_FORAGE_RETENTION_BRAINS,
  HIDDEN_FORAGE_TYPES,
  HIDDEN_FORAGE_WEIGHTS,
  selectHiddenForageType,
} from "./families/forage-identification-event";

export type {
  ForageIdentificationEventOptions,
  ForageItemDefinitions,
  HiddenForageType,
} from "./families/forage-identification-event";
