import { getNextRound } from "~/game/engine/rounds";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
} from "~/game/events/event-change-builders";
import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { selectCornucopiaPackItem } from "~/game/events/catalogue/bloodbath/cornucopia-item-pool";
import { createTruceInstance } from "~/game/truces/truce-engine";
import type { GameChange, GameTribute, RoundReference } from "~/game/types/game-state";
import type { RandomSource } from "~/game/engine/random";

type GroupSize = 3 | 4;

interface CornucopiaGroupEventOptions {
  id: string;
  participantCount: GroupSize;
  category: "survival" | "hazard";
  tags: EventDefinition["tags"];
  baseWeight: number;
  formsTruce?: boolean;
  getText: (tributes: readonly GameTribute[]) => string;
  getAdditionalChanges?: (
    eventId: string,
    round: RoundReference,
    tributes: readonly GameTribute[],
  ) => readonly GameChange[];
}

function requireTrio(
  tributes: readonly GameTribute[],
  label: string,
): readonly [GameTribute, GameTribute, GameTribute] {
  const [first, second, third] = tributes;

  if (!first || !second || !third) {
    throw new Error(`${label} requires exactly three tributes.`);
  }

  return [first, second, third];
}

function requireQuartet(
  tributes: readonly GameTribute[],
  label: string,
): readonly [GameTribute, GameTribute, GameTribute, GameTribute] {
  const [first, second, third, fourth] = tributes;

  if (!first || !second || !third || !fourth) {
    throw new Error(`${label} requires exactly four tributes.`);
  }

  return [first, second, third, fourth];
}

function createFoodSatisfactionChanges(tributes: readonly GameTribute[]): GameChange[] {
  return tributes.map((tribute): GameChange => ({
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need: "food",
  }));
}

function createGroupAcquisitionChanges(
  eventId: string,
  round: RoundReference,
  tributes: readonly GameTribute[],
  random: RandomSource,
): GameChange[] {
  return tributes.flatMap((tribute) =>
    createItemAcquisitionAndSurvivalChanges(
      eventId,
      tribute,
      [selectCornucopiaPackItem(tribute, random)],
      round,
      "cornucopia",
    ),
  );
}

function createTemporaryTruceChange(
  eventId: string,
  round: RoundReference,
  tributes: readonly GameTribute[],
): GameChange {
  return {
    type: "form-truce",
    truce: createTruceInstance(
      eventId,
      tributes.map((tribute) => tribute.id),
      round,
      getNextRound(round),
    ),
  };
}

function createCornucopiaGroupEvent({
  id,
  participantCount,
  category,
  tags,
  baseWeight,
  formsTruce = false,
  getText,
  getAdditionalChanges,
}: CornucopiaGroupEventOptions): EventDefinition {
  return {
    id,
    category,
    tags,
    periods: ["day"],
    baseWeight,
    roles: [
      {
        id: "tributes",
        count: participantCount,
      },
    ],
    resolve({ eventId, round, random, participantsByRole }): EventResolution {
      const tributes = requireParticipants(participantsByRole, "tributes");

      if (tributes.length !== participantCount) {
        throw new Error(
          `Cornucopia group event "${id}" expected ` +
            `${participantCount} tributes but received ` +
            `${tributes.length}.`,
        );
      }

      return {
        text: getText(tributes),
        changes: [
          ...(formsTruce ? [createTemporaryTruceChange(eventId, round, tributes)] : []),
          ...createGroupAcquisitionChanges(eventId, round, tributes, random),
          ...(getAdditionalChanges?.(eventId, round, tributes) ?? []),
        ],
      };
    },
  };
}

const THREE_WAY_BACKPACK_TEAR_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-trio-backpack-tear",
  participantCount: 3,
  category: "hazard",
  tags: ["hazard", "item", "resource", "combat"],
  baseWeight: 3.8,
  getText(tributes) {
    const [actor, ally, target] = requireTrio(tributes, "Three-way backpack tear");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, and ` +
      `${target.snapshot.name} seize the same backpack from three ` +
      "different directions. The straps surrender before any tribute " +
      "does, spraying supplies across the ground. Each grabs something " +
      "useful, nods as though this was an agreed distribution system, " +
      "and runs."
    );
  },
});

const TRIO_CRATE_BATTERING_RAM_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-trio-crate-battering-ram",
  participantCount: 3,
  category: "survival",
  tags: ["survival", "item", "resource", "truce", "cooperative"],
  baseWeight: 3.4,
  formsTruce: true,
  getText(tributes) {
    const [actor, ally, target] = requireTrio(tributes, "Crate battering ram");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, and ` +
      `${target.snapshot.name} duck behind a long supply crate when ` +
      'weapons begin flying. Someone yells, "Push!" and the three ' +
      "accidentally turn it into a battering ram, plowing a path through " +
      "the scramble. They loot whatever sticks to the crate and flee " +
      "together before questioning the alliance."
    );
  },
});

const TRIO_WEAPON_RACK_DOMINO_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-trio-weapon-rack-domino",
  participantCount: 3,
  category: "hazard",
  tags: ["hazard", "item", "resource", "combat"],
  baseWeight: 3.5,
  getText(tributes) {
    const [actor, ally, target] = requireTrio(tributes, "Weapon-rack domino");

    return (
      `${actor.snapshot.name} reaches for the top of a weapon rack just ` +
      `as ${ally.snapshot.name} crashes into its base. ` +
      `${target.snapshot.name} tries to catch the rack, causing the ` +
      "entire display to fold like a row of deck chairs. All three " +
      "emerge clutching useful gear. Nobody makes eye contact."
    );
  },
  getAdditionalChanges(eventId, round, tributes) {
    const [, ally] = requireTrio(tributes, "Weapon-rack domino");

    return [createStatusChange(eventId, ally, "injured", 1, round)];
  },
});

const TRIO_CANNED_PEACHES_CEASEFIRE_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-trio-canned-peaches-ceasefire",
  participantCount: 3,
  category: "survival",
  tags: ["survival", "item", "resource", "truce", "cooperative"],
  baseWeight: 3,
  formsTruce: true,
  getText(tributes) {
    const [actor, ally, target] = requireTrio(tributes, "Canned-peaches ceasefire");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, and ` +
      `${target.snapshot.name} converge on a crate prepared to fight. ` +
      "Inside they find canned peaches, a can opener, and exactly three " +
      "spoons. This is interpreted as a sign from the universe. They eat, " +
      "divide the nearby gear, and leave in the briefest and most " +
      "practical truce in Hunger Games history."
    );
  },
  getAdditionalChanges(eventId, round, tributes) {
    return [
      ...createFoodSatisfactionChanges(tributes),
      ...tributes.map((tribute) => createStatusChange(eventId, tribute, "well-fed", 1, round)),
    ];
  },
});

const TRIO_DISTRACTION_CIRCLE_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-trio-distraction-circle",
  participantCount: 3,
  category: "hazard",
  tags: ["hazard", "item", "resource"],
  baseWeight: 3.7,
  getText(tributes) {
    const [actor, ally, target] = requireTrio(tributes, "Distraction circle");

    return (
      `${actor.snapshot.name} points behind ${ally.snapshot.name} and ` +
      `shouts, "Knife!" ${ally.snapshot.name} points behind ` +
      `${target.snapshot.name} and shouts, "Axe!" ` +
      `${target.snapshot.name} points behind ${actor.snapshot.name} and ` +
      'shouts, "Mutt!" After one complete rotation, all three are ' +
      "holding supplies and nobody remembers who started lying. They " +
      "retreat in different directions."
    );
  },
});

const TRIO_SUPPLY_NET_PINATA_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-trio-supply-net-pinata",
  participantCount: 3,
  category: "hazard",
  tags: ["hazard", "item", "resource"],
  baseWeight: 3.3,
  getText(tributes) {
    const [actor, ally, target] = requireTrio(tributes, "Supply-net piñata");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, and ` +
      `${target.snapshot.name} yank the same hanging cargo net from ` +
      "different sides. The knot gives up and turns the net into a " +
      "supply piñata. Useful gear rains down. Each catches something; " +
      `${target.snapshot.name} also catches a wooden crate lid to ` +
      "the forehead."
    );
  },
  getAdditionalChanges(eventId, round, tributes) {
    const [, , target] = requireTrio(tributes, "Supply-net piñata");

    return [createStatusChange(eventId, target, "injured", 1, round)];
  },
});

const QUARTET_BACKPACK_MUSICAL_CHAIRS_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-quartet-backpack-musical-chairs",
  participantCount: 4,
  category: "hazard",
  tags: ["hazard", "item", "resource"],
  baseWeight: 3.5,
  getText(tributes) {
    const [actor, ally, target, bystander] = requireQuartet(tributes, "Backpack musical chairs");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, ` +
      `${target.snapshot.name}, and ${bystander.snapshot.name} each ` +
      "snatch a backpack. One tribute peeks into the next bag and decides " +
      "it looks better, beginning a frantic circle of unwanted trades. " +
      "A cannon fires in the distance and everyone runs with whichever " +
      "pack happens to be in hand."
    );
  },
});

const QUARTET_TARP_SAIL_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-quartet-tarp-sail",
  participantCount: 4,
  category: "hazard",
  tags: ["hazard", "item", "resource", "environment"],
  baseWeight: 3.2,
  getText(tributes) {
    const [actor, ally, target, bystander] = requireQuartet(tributes, "Tarp sail");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, ` +
      `${target.snapshot.name}, and ${bystander.snapshot.name} grab ` +
      "four corners of a tarp covering a supply pile. A gust catches it " +
      "like a sail and drags all four through several boxes. When the tarp " +
      "finally collapses, each crawls out with useful gear and a silent " +
      "agreement never to describe what just happened."
    );
  },
});

const QUARTET_CRATE_PYRAMID_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-quartet-crate-pyramid",
  participantCount: 4,
  category: "hazard",
  tags: ["hazard", "item", "resource", "environment"],
  baseWeight: 3.1,
  getText(tributes) {
    const [actor, ally, target, bystander] = requireQuartet(tributes, "Crate pyramid");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, ` +
      `${target.snapshot.name}, and ${bystander.snapshot.name} stack ` +
      "supply crates into a pyramid to reach a locked case. The pyramid " +
      "immediately collapses. Each tribute rides a crate to the ground " +
      "like a terrible parade float, grabs something useful from the " +
      "wreckage, and runs."
    );
  },
  getAdditionalChanges(eventId, round, tributes) {
    const [, , , bystander] = requireQuartet(tributes, "Crate pyramid");

    return [createStatusChange(eventId, bystander, "injured", 1, round)];
  },
});

const QUARTET_CIRCULAR_THEFT_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-quartet-circular-theft",
  participantCount: 4,
  category: "hazard",
  tags: ["hazard", "item", "resource", "combat"],
  baseWeight: 3.6,
  getText(tributes) {
    const [actor, ally, target, bystander] = requireQuartet(tributes, "Circular theft");

    return (
      `${actor.snapshot.name} snatches the gear ` +
      `${ally.snapshot.name} was reaching for. ` +
      `${ally.snapshot.name} retaliates by taking ` +
      `${target.snapshot.name}'s supplies, so ` +
      `${target.snapshot.name} steals from ${bystander.snapshot.name}, ` +
      `who calmly takes what ${actor.snapshot.name} set down. The four ` +
      "stare at the completed circle of theft, decide the accounting is " +
      "impossible, and flee with one item each."
    );
  },
});

const QUARTET_MOVING_BARRICADE_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-quartet-moving-barricade",
  participantCount: 4,
  category: "survival",
  tags: ["survival", "item", "resource", "truce", "cooperative"],
  baseWeight: 3.3,
  formsTruce: true,
  getText(tributes) {
    const [actor, ally, target, bystander] = requireQuartet(tributes, "Moving barricade");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, ` +
      `${target.snapshot.name}, and ${bystander.snapshot.name} all hide ` +
      "behind the same broad supply crate. As armed tributes approach, " +
      "the four push it together and discover it makes an excellent " +
      "moving barricade. They bulldoze across the Cornucopia, collect " +
      "gear in its path, and escape as an accidental team."
    );
  },
});

const QUARTET_ALLIANCE_NAME_EVENT = createCornucopiaGroupEvent({
  id: "cornucopia-nonfatal-quartet-alliance-name",
  participantCount: 4,
  category: "survival",
  tags: ["survival", "item", "resource", "truce", "cooperative"],
  baseWeight: 3,
  formsTruce: true,
  getText(tributes) {
    const [actor, ally, target, bystander] = requireQuartet(tributes, "Alliance naming committee");

    return (
      `${actor.snapshot.name}, ${ally.snapshot.name}, ` +
      `${target.snapshot.name}, and ${bystander.snapshot.name} agree ` +
      "that a temporary alliance would improve their odds. They spend " +
      'several dangerous seconds debating names including "Bloodbath ' +
      'Buddies," "The Cornucopia Crew," and "Four-midable." A thrown ' +
      "knife ends the meeting. They grab gear and flee under the " +
      'provisional name "Run Now, Brand Later."'
    );
  },
});

export const ADDITIONAL_CORNUCOPIA_NONFATAL_TRIO_EVENTS = [
  THREE_WAY_BACKPACK_TEAR_EVENT,
  TRIO_CRATE_BATTERING_RAM_EVENT,
  TRIO_WEAPON_RACK_DOMINO_EVENT,
  TRIO_CANNED_PEACHES_CEASEFIRE_EVENT,
  TRIO_DISTRACTION_CIRCLE_EVENT,
  TRIO_SUPPLY_NET_PINATA_EVENT,
] satisfies readonly EventDefinition[];

export const ADDITIONAL_CORNUCOPIA_NONFATAL_QUARTET_EVENTS = [
  QUARTET_BACKPACK_MUSICAL_CHAIRS_EVENT,
  QUARTET_TARP_SAIL_EVENT,
  QUARTET_CRATE_PYRAMID_EVENT,
  QUARTET_CIRCULAR_THEFT_EVENT,
  QUARTET_MOVING_BARRICADE_EVENT,
  QUARTET_ALLIANCE_NAME_EVENT,
] satisfies readonly EventDefinition[];
