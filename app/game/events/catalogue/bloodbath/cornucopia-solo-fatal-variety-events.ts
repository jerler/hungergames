import { createSeededRandom, shuffleItems } from "~/game/engine/random";
import { createFatalChanges } from "~/game/events/event-change-builders";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameTribute } from "~/game/types/game-state";

const SOLO_FATAL_VARIETY_SLOT_COUNT = 2;

const SOLO_FATAL_VARIETY_EVENT_IDS = [
  "cornucopia-fatal-crate-avalanche",
  "cornucopia-fatal-shield-sled",
  "cornucopia-fatal-loaded-crossbow-inspection",
  "cornucopia-fatal-armful-of-knives",
  "cornucopia-fatal-backpack-weapon-rack-snare",
  "cornucopia-fatal-cast-iron-cookware",
] as const;

type SoloFatalVarietyEventId = (typeof SOLO_FATAL_VARIETY_EVENT_IDS)[number];

interface SoloFatalVarietyEventOptions {
  id: SoloFatalVarietyEventId;
  baseWeight: number;
  causeLabel: string;
  tags?: EventDefinition["tags"];
  getText: (tribute: GameTribute) => string;
}

function getEligibleSoloFatalVarietyIds(gameSeed: string): ReadonlySet<SoloFatalVarietyEventId> {
  const shuffledIds = shuffleItems(
    SOLO_FATAL_VARIETY_EVENT_IDS,
    createSeededRandom(`${gameSeed}:solo-fatal-variety-slots`),
  );

  return new Set(shuffledIds.slice(0, SOLO_FATAL_VARIETY_SLOT_COUNT));
}

function createSoloFatalVarietyEvent({
  id,
  baseWeight,
  causeLabel,
  tags = ["fatal", "environment"],
  getText,
}: SoloFatalVarietyEventOptions): EventDefinition {
  return {
    id,
    category: "fatal",
    tags,
    periods: ["day"],
    baseWeight,
    isEligible: ({ state }) => getEligibleSoloFatalVarietyIds(state.seed).has(id),
    roles: [
      {
        id: "actor",
        count: 1,
      },
    ],
    resolve({ participantsByRole }): EventResolution {
      const actor = requireSingleParticipant(participantsByRole, "actor");
      const text = getText(actor);

      return {
        text,
        changes: createFatalChanges(actor, id, causeLabel, text),
      };
    },
  };
}

const CRATE_AVALANCHE_EVENT = createSoloFatalVarietyEvent({
  id: "cornucopia-fatal-crate-avalanche",
  baseWeight: 1.9,
  causeLabel: "Crushed by collapsing Cornucopia crates",
  getText: (actor) =>
    `${actor.snapshot.name} spots a golden shortsword at the top of a tower of supply crates. ` +
    `${getTributePronouns(actor).Subject} decides to climb after it, only to have the entire stack collapse directly onto ` +
    `${getTributePronouns(actor).object}. The only thing left was one hand still reaching out amongst the rubble.`,
});

const SHIELD_SLED_EVENT = createSoloFatalVarietyEvent({
  id: "cornucopia-fatal-shield-sled",
  baseWeight: 1.7,
  causeLabel: "Killed in a shield-sled accident",
  tags: ["fatal", "environment", "weapon", "item"],
  getText: (actor) =>
    `${actor.snapshot.name} sees the carnage around ${getTributePronouns(actor).object} and decides ${getTributePronouns(actor).subject} needs to get out of there. ${getTributePronouns(actor).Subject} grabs a shield and decides the sloped side ` +
    "of the Cornucopia looks remarkably sled-shaped. The ride is fast, " +
    "brief, and exhilarating right up until the shield launches " +
    `${actor.snapshot.name} into a rack of spears.`,
});

const LOADED_CROSSBOW_INSPECTION_EVENT = createSoloFatalVarietyEvent({
  id: "cornucopia-fatal-loaded-crossbow-inspection",
  baseWeight: 1.6,
  causeLabel: "Accidentally discharged a loaded crossbow",
  tags: ["fatal", "environment", "weapon", "item"],
  getText: (actor) =>
    `${actor.snapshot.name} finds a crossbow and peers closely at it, ` +
    'trying to figure out if it\'s already loaded. One accidental "click" later, turns out, it was.',
});

const ARMFUL_OF_KNIVES_EVENT = createSoloFatalVarietyEvent({
  id: "cornucopia-fatal-armful-of-knives",
  baseWeight: 1.8,
  causeLabel: "Fell while carrying Cornucopia knives",
  tags: ["fatal", "environment", "weapon", "item"],
  getText: (actor) =>
    `${actor.snapshot.name} gathers an ambitious armful of knives and ` +
    "tries to sprint away with all of them. A coil of rope catches " +
    `${getTributePronouns(actor).possessiveAdjective} ankle. ` +
    `${actor.snapshot.name} has just enough time to realize that fewer ` +
    "knives would have been plenty before they get skewered by a half-dozen blades.",
});

const BACKPACK_WEAPON_RACK_SNARE_EVENT = createSoloFatalVarietyEvent({
  id: "cornucopia-fatal-backpack-weapon-rack-snare",
  baseWeight: 1.5,
  causeLabel: "Caught in a Cornucopia weapon rack",
  tags: ["fatal", "environment", "weapon", "item"],
  getText: (actor) =>
    `${actor.snapshot.name} swings an overstuffed backpack over ` +
    `${getTributePronouns(actor).possessiveAdjective} shoulder. One ` +
    "loose strap hooks around a rotating weapon rack, which whips " +
    `${actor.snapshot.name} backward into the display before ` +
    `${getTributePronouns(actor).subject} can let go.`,
});

const CAST_IRON_COOKWARE_EVENT = createSoloFatalVarietyEvent({
  id: "cornucopia-fatal-cast-iron-cookware",
  baseWeight: 1.4,
  causeLabel: "Crushed by Cornucopia cookware",
  tags: ["fatal", "environment", "item", "resource"],
  getText: (actor) =>
    `${actor.snapshot.name} wrestles open a crate labelled COOKWARE, ` +
    "hoping to find food. Instead, the massive crate is filled to the brim with heavy cast iron pans. The crate tips forward and buries " +
    `${getTributePronouns(actor).object} beneath. The final skillet lands with a polite little clang.`,
});

export const ADDITIONAL_CORNUCOPIA_SOLO_FATAL_EVENTS = [
  CRATE_AVALANCHE_EVENT,
  SHIELD_SLED_EVENT,
  LOADED_CROSSBOW_INSPECTION_EVENT,
  ARMFUL_OF_KNIVES_EVENT,
  BACKPACK_WEAPON_RACK_SNARE_EVENT,
  CAST_IRON_COOKWARE_EVENT,
] satisfies readonly EventDefinition[];
