import { getEffectiveStats } from "~/game/engine/effective-stats";
import {
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolutionContext,
} from "~/game/events/event-schema";
import { getItemDefinition } from "~/game/items/item-catalogue";
import { CRAFTABLE_WEAPON_ITEM_IDS, type CraftableWeaponItemId } from "~/game/items/item-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameTribute } from "~/game/types/game-state";

interface CraftingTexts {
  criticalFailure: (actor: GameTribute) => string;
  failure: (actor: GameTribute) => string;
  success: (actor: GameTribute) => string;
  exceptionalSuccess: (actor: GameTribute) => string;
}

interface CraftingEventOptions {
  id: string;
  itemId: CraftableWeaponItemId;
  weight: number;
  score: (actor: GameTribute) => number;
  texts: CraftingTexts;
}

function hasOwnedWeapon(tribute: GameTribute): boolean {
  return tribute.inventory.some((item) =>
    (getItemDefinition(item.definitionId).tags as readonly string[]).includes("weapon"),
  );
}

function resolveCraftingOutcome(
  context: EventResolutionContext,
  actor: GameTribute,
  itemId: CraftableWeaponItemId,
  outcome: StatCheckOutcome,
  texts: CraftingTexts,
) {
  switch (outcome) {
    case "critical-failure":
      return {
        text: texts.criticalFailure(actor),
        changes: [
          createStatusChange(context.eventId, actor, "injured", 1, context.round),
          ...createSurvivalChanges([actor]),
        ],
      };
    case "failure":
      return {
        text: texts.failure(actor),
        changes: createSurvivalChanges([actor]),
      };
    case "success":
      return {
        text: texts.success(actor),
        changes: createItemAcquisitionAndSurvivalChanges(
          context.eventId,
          actor,
          [itemId],
          context.round,
          "crafted",
        ),
      };
    case "exceptional-success":
      return {
        text: texts.exceptionalSuccess(actor),
        changes: [
          ...createItemAcquisitionAndSurvivalChanges(
            context.eventId,
            actor,
            [itemId],
            context.round,
            "crafted",
          ),
          createStatusChange(context.eventId, actor, "inspired", 1, context.round),
        ],
      };
  }
}

function createCraftingEvent({
  id,
  itemId,
  weight,
  score,
  texts,
}: CraftingEventOptions): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: weight,
    tags: ["survival", "item", "weapon", "tool", "status"],
    roles: [
      {
        id: "actor",
        count: 1,
        isEligible: (tribute) => !hasOwnedWeapon(tribute),
        getWeight: (tribute) => score(tribute),
      },
    ],
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const outcome = resolveScoreCheck({
        score: score(actor),
        difficulty: 3,
        random: context.random,
      });

      return resolveCraftingOutcome(context, actor, itemId, outcome, texts);
    },
  };
}

const MAKE_A_KNIFE = createCraftingEvent({
  id: "day-make-knife",
  itemId: "knife",
  weight: 5,
  score: (actor) => {
    const stats = getEffectiveStats(actor);

    return Math.max(stats.brains, stats.luck);
  },
  texts: {
    criticalFailure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} finds a sharp stone and attempts to shape it into a knife. ` +
        `The stone splits without warning and slices deeply across ${pronouns.possessiveAdjective} hand.`
      );
    },
    failure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} spends the afternoon striking stones together in an attempt to make a knife. ` +
        `By the time ${pronouns.subject} gives up, ${pronouns.subject} sits among an assortment of pebbles, ` +
        "none useful as weapons."
      );
    },
    success: (actor) =>
      `${actor.snapshot.name} carefully chips a naturally sharp stone into shape and wraps the base ` +
      "with bark and grass to make a crude but serviceable knife.",
    exceptionalSuccess: (actor) =>
      `${actor.snapshot.name} patiently flakes a flat stone into a keen edge and binds it to a carved ` +
      "wooden handle. The finished knife is alarmingly sharp for something made entirely in the woods.",
  },
});

const CARVE_A_WOODEN_CLUB = createCraftingEvent({
  id: "day-carve-wooden-club",
  itemId: "club",
  weight: 6,
  score: (actor) => getEffectiveStats(actor).brains,
  texts: {
    criticalFailure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} attempts to break a heavy branch into a manageable club. ` +
        `It snaps much sooner than expected and swings directly into ${pronouns.possessiveAdjective} face.`
      );
    },
    failure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} spends the afternoon carving a branch into a weapon, only to produce ` +
        `something too crooked to swing and too heavy to carry. ${pronouns.Subject} leaves with less ` +
        "daylight and more resentment toward the tree."
      );
    },
    success: (actor) =>
      `${actor.snapshot.name} strips the smaller limbs from a sturdy fallen branch and carves the handle ` +
      "until it can be swung comfortably as a wooden club.",
    exceptionalSuccess: (actor) =>
      `${actor.snapshot.name} finds dense hardwood with a heavy knot at one end, smooths the grip, ` +
      "and balances the weight. The resulting club is crude, but surely deadly.",
  },
});

const MAKE_A_STONE_HAND_AXE = createCraftingEvent({
  id: "day-make-stone-hand-axe",
  itemId: "hand-axe",
  weight: 3.5,
  score: (actor) => getEffectiveStats(actor).brains,
  texts: {
    criticalFailure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} attempts to lash a sharpened stone to a wooden handle. ` +
        `When ${pronouns.subject} tests the binding, the stone tears free and buries itself in ` +
        `${pronouns.possessiveAdjective} leg.`
      );
    },
    failure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} spends hours shaping a stone and fastening it to a branch, but the head ` +
        `shifts with every swing. After narrowly avoiding hitting ${pronouns.reflexive}, ` +
        `${pronouns.subject} decides the design needs more research.`
      );
    },
    success: (actor) =>
      `${actor.snapshot.name} chips a broad stone into a sharp wedge, fits it into a split wooden handle, ` +
      "and secures it with twisted bark to make a functional hand axe.",
    exceptionalSuccess: (actor) =>
      `${actor.snapshot.name} shapes a flat stone into a keen axe head, carves a fitted groove into a sturdy ` +
      "handle, and binds the pieces with plant fibre. The weapon survives several enthusiastic test swings.",
  },
});

const BUILD_A_BOW = createCraftingEvent({
  id: "day-build-bow",
  itemId: "bow",
  weight: 2,
  score: (actor) => getEffectiveStats(actor).brains,
  texts: {
    criticalFailure: (actor) => {
      const pronouns = getTributePronouns(actor);

      return (
        `${actor.snapshot.name} bends a flexible branch into a bow and pulls the improvised string tight. ` +
        `The wood snaps immediately, striking ${pronouns.object} across the face with a humbling sting.`
      );
    },
    failure: (actor) =>
      `${actor.snapshot.name} spends most of the afternoon assembling a bow from flexible wood and plant fibre. ` +
      "The first test shot travels several pitiful inches before the bow returns to being a complicated bundle of sticks.",
    success: (actor) =>
      `${actor.snapshot.name} bends a flexible branch, strings it with twisted plant fibre, and carves several ` +
      "straight sticks into crude arrows. The finished bow lacks elegance, but it fires.",
    exceptionalSuccess: (actor) =>
      `${actor.snapshot.name} balances a flexible length of wood, twists strong plant fibres into a bowstring, ` +
      "and crafts stone-tipped arrows. The first test shot strikes the centre of a nearby tree.",
  },
});

export const DAY_CRAFTING_EVENTS = [
  MAKE_A_KNIFE,
  CARVE_A_WOODEN_CLUB,
  MAKE_A_STONE_HAND_AXE,
  BUILD_A_BOW,
] satisfies readonly EventDefinition[];

export const DAY_CRAFTABLE_WEAPON_IDS = CRAFTABLE_WEAPON_ITEM_IDS;
