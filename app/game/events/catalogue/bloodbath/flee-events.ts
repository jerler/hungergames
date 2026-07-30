import { getEffectiveStats } from "~/game/engine/effective-stats";
import { getAwarenessScore } from "~/game/engine/stat-formulas";
import {
  createFatalChanges,
  createItemAcquisitionAndSurvivalChanges,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import { resolveScoreCheck, type StatCheckOutcome } from "~/game/events/event-outcomes";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import type { SurvivalNeed } from "~/game/survival/survival-schema";
import {
  createTruceInstance,
  getActiveTruceForTribute,
  STANDARD_TRUCE_EXPIRY_ROUND,
} from "~/game/truces/truce-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute, RoundReference } from "~/game/types/game-state";

import { MULTI_PARTICIPANT_FLEE_EVENTS } from "./flee-multi-events";

const FLEE_CHECK_DIFFICULTY = 3;

type FleeCheck = "brains" | "brawn" | "luck" | "brains-or-awareness" | "brawn-or-luck";

interface StatusApplication {
  tribute: GameTribute;
  statusId: StatusEffectId;
  severity: 1 | 2 | 3;
}

interface NeedSatisfaction {
  tribute: GameTribute;
  need: SurvivalNeed;
}

interface SoloOutcomeContext {
  eventId: string;
  round: RoundReference;
  actor: GameTribute;
  text: string;
}

interface SoloOutcome {
  text: (actor: GameTribute) => string;
  changes: (context: SoloOutcomeContext) => GameChange[];
}

type SoloOutcomes = Readonly<Record<StatCheckOutcome, SoloOutcome>>;

interface SoloFleeEventOptions {
  check: FleeCheck;
  weight: number;
  tags?: EventDefinition["tags"];
  fatalCapable?: boolean;
  outcomes: SoloOutcomes;
}

function getFleeCheckScore(actor: GameTribute, check: FleeCheck, round: RoundReference): number {
  const stats = getEffectiveStats(actor);

  switch (check) {
    case "brains":
      return stats.brains;
    case "brawn":
      return stats.brawn;
    case "luck":
      return stats.luck;
    case "brains-or-awareness":
      return Math.max(stats.brains, getAwarenessScore(actor, round));
    case "brawn-or-luck":
      return Math.max(stats.brawn, stats.luck);
  }
}

function createNeedSatisfactionChange({ tribute, need }: NeedSatisfaction): GameChange {
  return {
    type: "satisfy-survival-need",
    tributeId: tribute.id,
    need,
  };
}

function createSurvivingOutcomeChanges(
  eventId: string,
  round: RoundReference,
  survivors: readonly GameTribute[],
  statuses: readonly StatusApplication[] = [],
  needs: readonly NeedSatisfaction[] = [],
  additionalChanges: readonly GameChange[] = [],
): GameChange[] {
  return [
    ...statuses.map(({ tribute, statusId, severity }) =>
      createStatusChange(eventId, tribute, statusId, severity, round),
    ),
    ...needs.map(createNeedSatisfactionChange),
    ...additionalChanges,
    ...createSurvivalChanges(survivors),
  ];
}

function createSoloFleeEvent(
  id: string,
  { check, weight, tags = [], fatalCapable = false, outcomes }: SoloFleeEventOptions,
): EventDefinition {
  const eventTags: EventDefinition["tags"] = [
    "survival",
    "environment",
    ...(fatalCapable ? (["fatal"] as const) : []),
    ...tags,
  ];

  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: weight,
    tags: eventTags,
    roles: [
      {
        id: "actor",
        count: 1,
      },
    ],
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const outcome = resolveScoreCheck({
        score: getFleeCheckScore(actor, check, context.round),
        difficulty: FLEE_CHECK_DIFFICULTY,
        random: context.random,
      });
      const outcomeDefinition = outcomes[outcome];
      const text = outcomeDefinition.text(actor);

      return {
        text,
        changes: outcomeDefinition.changes({
          eventId: context.eventId,
          round: context.round,
          actor,
          text,
        }),
      };
    },
  };
}

function surviveAlone(
  context: SoloOutcomeContext,
  statuses: readonly Omit<StatusApplication, "tribute">[] = [],
  needs: readonly SurvivalNeed[] = [],
): GameChange[] {
  return createSurvivingOutcomeChanges(
    context.eventId,
    context.round,
    [context.actor],
    statuses.map(({ statusId, severity }) => ({
      tribute: context.actor,
      statusId,
      severity,
    })),
    needs.map((need) => ({
      tribute: context.actor,
      need,
    })),
  );
}

function eliminateWithoutKiller(
  context: SoloOutcomeContext,
  causeId: string,
  causeLabel: string,
): GameChange[] {
  return createFatalChanges(context.actor, causeId, causeLabel, context.text);
}

const RUN_FROM_CORNUCOPIA = createSoloFleeEvent("bloodbath-flee-run-from-cornucopia", {
  check: "brawn",
  weight: 5,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) =>
        `${actor.snapshot.name} sprints blindly from the Cornucopia, ` +
        "discovering at full speed that the forest contains significantly " +
        `more branches than expected. ${actor.snapshot.name} escapes, ` +
        "but not gracefully.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} runs until the sounds of the Bloodbath ` +
        "fade into the distance, then collapses against a tree and tries " +
        "to heave in air as quietly as possible.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} runs directly into the woods and puts ` +
        `a safe distance between ${getTributePronouns(actor).reflexive} ` +
        "and the Cornucopia before finally slowing down to think of a plan.",
      changes: (context) => surviveAlone(context),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} bursts into the woods, changes direction ` +
        "beneath the cover of the trees, and finds a safe place to hide " +
        "before anyone can follow.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
  },
});

const VANISH_INTO_TALL_GRASS = createSoloFleeEvent("bloodbath-flee-tall-grass", {
  check: "brains-or-awareness",
  weight: 3,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} sprints away from the Cornucopia, ` +
          "dives into the first patch of tall grass available, and begins crawling " +
          "away, leaving such an obvious trail that the flattened grass " +
          `practically includes an arrow pointing toward ${pronouns.object}.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hunted",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} sprints away from the Cornucopia, ` +
          `throws ${pronouns.reflexive} into the first patch of tall grass, ` +
          "and crawls in three different directions trying not to leave " +
          "a trail, only to become completely uncertain which way leads " +
          "away from the Cornucopia."
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "disoriented",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} sprints away from the Cornucopia, ` +
        "quickly slips into the tall grass, carefully manoeuvres without " +
        "leaving a trail, and disappears beneath the shifting field.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} sprints away from the Cornucopia, ` +
        "slips into the tall grass without leaving a trail, and finds a " +
        "hiding spot that offers a clear view of anyone approaching.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
          {
            statusId: "alert",
            severity: 1,
          },
        ]),
    },
  },
});

const COVER_TRACKS = createSoloFleeEvent("bloodbath-flee-cover-tracks", {
  check: "brains",
  weight: 3,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} heads into the woods and runs straight ` +
          `into a mud trail. ${actor.snapshot.name} tries to confuse anyone ` +
          `following by walking backward over ${pronouns.possessiveAdjective} ` +
          "footprints, apparently forgetting that the prints still form one " +
          `continuous path directly to ${pronouns.object}.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hunted",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} heads into the woods and notices the ` +
          `heavy footprints ${pronouns.subject} ${pronouns.bePresent} leaving. ` +
          `${actor.snapshot.name} spends so long sweeping them away that ` +
          "the sounds of the Bloodbath remain uncomfortably close."
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} sprints into the woods, finds a rocky ` +
        "patch where no continuous tracks can form, and escapes without " +
        "leaving an obvious route to follow.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} creates a false trail toward the river, ` +
        "circles back through the trees, and finds a hiding place from which " +
        "to watch other tributes follow the trail in the wrong direction.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
          {
            statusId: "alert",
            severity: 1,
          },
        ]),
    },
  },
});

const FOLLOW_INSECTS_TO_WATER = createSoloFleeEvent("bloodbath-flee-follow-insects-water", {
  check: "brains",
  weight: 3,
  tags: ["resource", "status"],
  outcomes: {
    "critical-failure": {
      text: (actor) =>
        `${actor.snapshot.name} runs into the woods to safety, follows a ` +
        "cloud of insects to a stagnant pool, decides that nature probably " +
        "knows what it is doing, and drinks without further investigation.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "poisoned",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} runs into the woods to safety, notices ` +
          "insects gathering nearby, and decides the insects can probably lead " +
          `${pronouns.object} to water. ${actor.snapshot.name} then spends ` +
          "the next hour following bugs like an idiot."
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "disoriented",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} sprints into the woods and hears ` +
          "mosquitoes humming in the distance. Following the sound leads " +
          `${pronouns.object} to a small stream.`
        );
      },
      changes: (context) => surviveAlone(context, [], ["water"]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} sprints into the woods, notices insects ` +
        "clustering along a shaded slope, uncovers a clear spring beneath " +
        "the rocks, and memorises the route before moving on.",
      changes: (context) => surviveAlone(context, [], ["water"]),
    },
  },
});

const EMERGENCY_FORAGING = createSoloFleeEvent("bloodbath-flee-emergency-foraging", {
  check: "brains",
  weight: 3,
  tags: ["resource", "status"],
  outcomes: {
    "critical-failure": {
      text: (actor) =>
        `${actor.snapshot.name} runs as far from the Cornucopia as ` +
        "possible, grows hungry, and chooses a handful of brightly coloured " +
        "berries entirely on vibes, discovering almost immediately that the " +
        "vibes were in fact poisonous.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "poisoned",
            severity: 2,
          },
        ]),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} runs as far from the Cornucopia as ` +
          "possible, grows hungry, finds an unfamiliar root, and eats just " +
          `enough to regret it before spending several minutes shitting ${pronouns.reflexive}.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "poisoned",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} runs as far from the Cornucopia as ` +
        "possible, recognises several edible plants beside the trail, and " +
        "stops to gather enough for a meal.",
      changes: (context) => surviveAlone(context, [], ["food"]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} runs as far from the Cornucopia as ` +
        "possible, recognises a patch of edible plants, finds ripe fruit " +
        "nearby, and assembles a lovely little picnic.",
      changes: (context) =>
        surviveAlone(
          context,
          [
            {
              statusId: "well-fed",
              severity: 1,
            },
          ],
          ["food"],
        ),
    },
  },
});

const HOLLOW_LOG = createSoloFleeEvent("bloodbath-flee-hollow-log", {
  check: "luck",
  weight: 3,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) =>
        `${actor.snapshot.name} runs away looking for a hiding spot, ` +
        "dives into a hollow log, and discovers that it is already occupied " +
        "by a family of squirrels with extremely firm opinions about " +
        "property rights.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} runs away looking for a hiding spot and ` +
          "eventually squeezes into a hollow log that is technically large " +
          `enough, provided ${actor.snapshot.name} leaves ` +
          `${pronouns.possessiveAdjective} legs sticking out like an idiot.`
        );
      },
      changes: (context) => surviveAlone(context),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} finds an empty hollow log, crawls inside, ` +
        "and waits until the last sounds from the Cornucopia disappear.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} finds a dry hollow beneath a fallen tree, ` +
        "conceals the opening with loose bark, and disappears completely " +
        "from sight.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
  },
});

const BRAMBLE_SHORTCUT = createSoloFleeEvent("bloodbath-flee-bramble-shortcut", {
  check: "brawn",
  weight: 3,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} charges through a wall of brambles. ` +
          "The thorns take several pieces of clothing as a toll and open " +
          `a deep cut across ${pronouns.possessiveAdjective} side.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "bleeding",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} forces a way through the brambles and ` +
        "escapes the Cornucopia covered in scratches, leaves, and " +
        "significantly less dignity.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} pushes through a dense wall of brambles ` +
        "that none of the pursuing tributes are willing to enter.",
      changes: (context) => surviveAlone(context),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} finds a narrow animal trail through the ` +
        "brambles, slips inside, and pulls the branches back into place.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
  },
});

const TERRITORIAL_GOOSE = createSoloFleeEvent("bloodbath-flee-territorial-goose", {
  check: "luck",
  weight: 2.5,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} flees the Cornucopia only to come ` +
          "face-to-face with an aggressively confident goose. An attempt to " +
          "shoo it away becomes an immediate attack, and the goose chases " +
          `${pronouns.object} for several hours deep into the woods.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
          {
            statusId: "hunted",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} flees the Cornucopia only to come ` +
        "face-to-face with an aggressively confident goose. They immediately " +
        "run away and are pursued through the trees for several hours.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} comes face-to-face with an aggressively ` +
        "confident goose, quickly reads the room, and slowly backs away " +
        "without making eye contact.",
      changes: (context) => surviveAlone(context),
    },
    "exceptional-success": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} comes face-to-face with an aggressively ` +
          "confident goose and attempts to talk things out by honking. " +
          `Somehow it works. The goose lets ${pronouns.object} pass unscathed, ` +
          "a glint of respect in its eye."
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "lucky",
            severity: 1,
          },
        ]),
    },
  },
});

const MUD_CAMOUFLAGE = createSoloFleeEvent("bloodbath-flee-mud-camouflage", {
  check: "brains",
  weight: 3,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} attempts to camouflage ${pronouns.reflexive} ` +
          "by leaping into a large patch of mud. The mud pulls " +
          `${pronouns.object} in like quicksand, and ${actor.snapshot.name} spends ` +
          `several hours dragging ${pronouns.reflexive} free with a tree branch.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} attempts to camouflage ${pronouns.reflexive} ` +
          "by rolling around in mud. The disguise is excellent, except for " +
          `the fact that ${actor.snapshot.name} still looks exactly the same, just covered in mud.`
        );
      },
      changes: (context) => surviveAlone(context),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} uses mud, twigs, and leaves to resemble ` +
        "an odd log or lump of mud, then settles against the roots of a " +
        "tree and blends into the forest floor.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
    "exceptional-success": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} expertly slathers mud over ` +
          `${pronouns.reflexive} to match the surrounding soil, masks ` +
          `${pronouns.possessiveAdjective} scent with crushed leaves, and ` +
          "becomes nearly indistinguishable from the forest floor."
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
          {
            statusId: "alert",
            severity: 1,
          },
        ]),
    },
  },
});

function createBreakAwayFromCrowdEvent(): EventDefinition {
  return {
    id: "bloodbath-flee-break-away-crowd",
    category: "survival",
    periods: ["day"],
    baseWeight: 2,
    tags: ["survival", "environment", "status", "truce", "cooperative"],
    roles: [
      {
        id: "actor",
        count: 1,
        isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
      },
      {
        id: "ally",
        count: 1,
        isEligible: (tribute, { state }) => getActiveTruceForTribute(state, tribute.id) === null,
      },
    ],
    isEligible: ({ state, livingTributes }) =>
      livingTributes.filter((tribute) => getActiveTruceForTribute(state, tribute.id) === null)
        .length >= 2,
    resolve(context) {
      const actor = requireSingleParticipant(context.participantsByRole, "actor");
      const ally = requireSingleParticipant(context.participantsByRole, "ally");
      const actorPronouns = getTributePronouns(actor);
      const outcome = resolveScoreCheck({
        score: getEffectiveStats(actor).brains,
        difficulty: FLEE_CHECK_DIFFICULTY,
        random: context.random,
      });

      if (outcome === "critical-failure") {
        const text =
          `${actor.snapshot.name} sees ${ally.snapshot.name} running from ` +
          "the Cornucopia and follows. When " +
          `${actor.snapshot.name} shouts for ${ally.snapshot.name} to wait, ` +
          `${ally.snapshot.name} vanishes into the tall grass. ` +
          `${actor.snapshot.name} keeps searching until ${actorPronouns.subject} ` +
          `${actorPronouns.bePresent} completely lost.`;

        return {
          text,
          changes: createSurvivingOutcomeChanges(
            context.eventId,
            context.round,
            [actor, ally],
            [
              {
                tribute: actor,
                statusId: "disoriented",
                severity: 1,
              },
              {
                tribute: actor,
                statusId: "exhausted",
                severity: 1,
              },
            ],
          ),
        };
      }

      if (outcome === "failure") {
        const text =
          `${actor.snapshot.name} sees ${ally.snapshot.name} running from ` +
          "the Cornucopia and follows, shouting that the pair should stick " +
          `together. ${ally.snapshot.name} continues deep into the woods, ` +
          `and ${actor.snapshot.name} eventually realises ${actorPronouns.subject} ` +
          `${actorPronouns.havePresent} been thoroughly left in the dust.`;

        return {
          text,
          changes: createSurvivingOutcomeChanges(
            context.eventId,
            context.round,
            [actor, ally],
            [
              {
                tribute: actor,
                statusId: "exhausted",
                severity: 1,
              },
            ],
          ),
        };
      }

      const truce = createTruceInstance(
        context.eventId,
        [actor.id, ally.id],
        context.round,
        STANDARD_TRUCE_EXPIRY_ROUND,
      );

      if (outcome === "success") {
        const text =
          `${actor.snapshot.name} sees ${ally.snapshot.name} running from ` +
          "the Cornucopia and suggests that the pair stick together. " +
          `${ally.snapshot.name} slows down and agrees to a truce, though ` +
          `${ally.snapshot.name} still seems deeply suspicious of ` +
          `${actor.snapshot.name}.`;

        return {
          text,
          changes: createSurvivingOutcomeChanges(
            context.eventId,
            context.round,
            [actor, ally],
            [],
            [],
            [
              {
                type: "form-truce",
                truce,
              },
            ],
          ),
        };
      }

      const text =
        `${actor.snapshot.name} sees ${ally.snapshot.name} running from ` +
        "the Cornucopia and suggests that the pair stick together. " +
        `${ally.snapshot.name} stops, agrees it is safer to work as a team, ` +
        "and together they find a concealed place from which to watch " +
        "for other tributes.";

      return {
        text,
        changes: createSurvivingOutcomeChanges(
          context.eventId,
          context.round,
          [actor, ally],
          [
            {
              tribute: actor,
              statusId: "hidden",
              severity: 1,
            },
            {
              tribute: ally,
              statusId: "hidden",
              severity: 1,
            },
          ],
          [],
          [
            {
              type: "form-truce",
              truce,
            },
          ],
        ),
      };
    },
  };
}

const CLIMB_ABOVE_CHAOS = createSoloFleeEvent("bloodbath-flee-climb-above-chaos", {
  check: "brawn",
  weight: 3,
  tags: ["status"],
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} uses ${pronouns.possessiveAdjective} ` +
          "strength to climb high into a tree, chooses a bad branch, and " +
          `falls all the way down, hitting ${pronouns.possessiveAdjective} ` +
          "head on several branches along the way."
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
        ]),
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} decides the safest place is high in a ` +
        "tree, climbs halfway up, loses footing, and falls back down while " +
        "narrowly avoiding several branches.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} scrambles halfway up a tree, finds a ` +
        "screen of leaves to hide behind, and waits until the routes below " +
        "are clear.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
        ]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} expertly scales a nearby tree and finds ` +
        "the perfect place to hide while watching the chaos around the " +
        "Cornucopia unfold in the distance.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
          {
            statusId: "alert",
            severity: 1,
          },
        ]),
    },
  },
});

const LEAP_ACROSS_CREEK = createSoloFleeEvent("bloodbath-flee-leap-across-creek", {
  check: "brawn-or-luck",
  weight: 0.75,
  tags: ["resource", "status"],
  fatalCapable: true,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} breaks away from the crowd and attempts ` +
          "a dramatic leap across a raging creek, lands in the deepest part, " +
          `and is swept into the rapids. ${pronouns.possessiveAdjective} head ` +
          `strikes a rock, and ${actor.snapshot.name} sinks unconscious beneath the water.`
        );
      },
      changes: (context) =>
        eliminateWithoutKiller(context, "bloodbath-flee-creek-drowning", "Drowned in the rapids"),
    },
    failure: {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} attempts a dramatic leap across a rushing ` +
          "creek, lands short, and is dragged down the rapids before finally " +
          `pulling ${pronouns.reflexive} ashore, bruised and gasping for air.`
        );
      },
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} leaps across a rushing creek to safety ` +
        "and pauses just long enough to drink some of the cool water.",
      changes: (context) => surviveAlone(context, [], ["water"]),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} clears a rushing creek in a moment of ` +
        "athletic excellence, lands perfectly, drinks from the water, and " +
        "finds a concealed place among the rocks.",
      changes: (context) =>
        surviveAlone(
          context,
          [
            {
              statusId: "hidden",
              severity: 1,
            },
          ],
          ["water"],
        ),
    },
  },
});

const CROSS_FALLEN_TREE = createSoloFleeEvent("bloodbath-flee-cross-fallen-tree", {
  check: "luck",
  weight: 0.35,
  tags: ["status"],
  fatalCapable: true,
  outcomes: {
    "critical-failure": {
      text: (actor) =>
        `${actor.snapshot.name} finds a raging river crossed by a ` +
        "well-placed fallen tree, confidently jumps onto the trunk, " +
        "immediately loses balance, and plummets into the water, never " +
        "to be seen again.",
      changes: (context) =>
        eliminateWithoutKiller(
          context,
          "bloodbath-flee-fallen-tree-drowning",
          "Swept away by the river",
        ),
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} carefully crosses a fallen tree above a ` +
        "raging river and almost reaches the far bank before the trunk " +
        "splits in two, sending the tribute into the water, never to be seen again.",
      changes: (context) =>
        eliminateWithoutKiller(
          context,
          "bloodbath-flee-fallen-tree-drowning",
          "Swept away by the river",
        ),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} carefully crosses a fallen tree above a ` +
        "raging river and reaches the grass just before the trunk splits " +
        "in two behind the safe bank.",
      changes: (context) => surviveAlone(context),
    },
    "exceptional-success": {
      text: (actor) =>
        `${actor.snapshot.name} risks crossing a fallen tree above a ` +
        "raging river. The trunk splits halfway across but launches the " +
        "tribute onto the far bank and directly into a perfect hiding place.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "hidden",
            severity: 1,
          },
          {
            statusId: "lucky",
            severity: 1,
          },
        ]),
    },
  },
});

const ESCAPE_STAMPEDE = createSoloFleeEvent("bloodbath-flee-escape-stampede", {
  check: "brawn",
  weight: 0.75,
  tags: ["status", "item", "weapon"],
  fatalCapable: true,
  outcomes: {
    "critical-failure": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} runs toward the Cornucopia, hears the ` +
          `stampede behind ${pronouns.object}, panics, and tries to change ` +
          `course toward the trees. The charging tributes trample ${pronouns.object} ` +
          "before escape is possible."
        );
      },
      changes: (context) =>
        eliminateWithoutKiller(context, "bloodbath-flee-stampede", "Trampled in the Bloodbath"),
    },
    failure: {
      text: (actor) =>
        `${actor.snapshot.name} tries to circle back toward the trees, ` +
        "is knocked down by the stampede, and is stepped on several times " +
        "before finally forcing a way to safety.",
      changes: (context) =>
        surviveAlone(context, [
          {
            statusId: "injured",
            severity: 1,
          },
          {
            statusId: "exhausted",
            severity: 1,
          },
        ]),
    },
    success: {
      text: (actor) =>
        `${actor.snapshot.name} hears the stampede approaching, makes a ` +
        "quick judgement call, and diverts toward the trees before the " +
        "bloodthirsty crowd can close the distance.",
      changes: (context) => surviveAlone(context),
    },
    "exceptional-success": {
      text: (actor) => {
        const pronouns = getTributePronouns(actor);

        return (
          `${actor.snapshot.name} veers toward the trees and narrowly ducks ` +
          `a knife thrown at ${pronouns.possessiveAdjective} head. ` +
          `${actor.snapshot.name} snatches it from the ground and disappears ` +
          "into the woods before the crowd can change course."
        );
      },
      changes: ({ eventId, round, actor }) =>
        createItemAcquisitionAndSurvivalChanges(eventId, actor, ["knife"], round, "cornucopia"),
    },
  },
});

export const FLEE_EVENTS = [
  RUN_FROM_CORNUCOPIA,
  VANISH_INTO_TALL_GRASS,
  COVER_TRACKS,
  FOLLOW_INSECTS_TO_WATER,
  EMERGENCY_FORAGING,
  HOLLOW_LOG,
  BRAMBLE_SHORTCUT,
  TERRITORIAL_GOOSE,
  MUD_CAMOUFLAGE,
  createBreakAwayFromCrowdEvent(),
  CLIMB_ABOVE_CHAOS,
  LEAP_ACROSS_CREEK,
  CROSS_FALLEN_TREE,
  ESCAPE_STAMPEDE,
  ...MULTI_PARTICIPANT_FLEE_EVENTS,
] satisfies readonly EventDefinition[];
