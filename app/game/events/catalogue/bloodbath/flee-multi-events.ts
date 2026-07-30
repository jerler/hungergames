import {
  createAttemptedKillChange,
  createEliminationChange,
  createFatalChanges,
  createKillCreditChange,
  createStatusChange,
  createSurvivalChanges,
} from "~/game/events/event-change-builders";
import {
  requireParticipants,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import type { StatusEffectId } from "~/game/statuses/status-schema";
import { createTruceInstance, STANDARD_TRUCE_EXPIRY_ROUND } from "~/game/truces/truce-engine";
import { createVendettaInstance } from "~/game/truces/vendetta-engine";
import { getTributePronouns } from "~/game/tributes/pronouns";
import type { GameChange, GameTribute, RoundReference } from "~/game/types/game-state";

type MultiFleeParticipantCount = 2 | 3 | 4;
type FleeResolutionContext = Parameters<EventDefinition["resolve"]>[0];

interface FleeStatusApplication {
  tribute: GameTribute;
  statusId: StatusEffectId;
  severity: 1 | 2 | 3;
  sourceTributeId?: string | null;
}

interface MultiFleeEventOptions {
  id: string;
  participantCount: MultiFleeParticipantCount;
  weight: number;
  tags?: EventDefinition["tags"];
  fatalCapable?: boolean;
  resolve: (context: FleeResolutionContext, tributes: readonly GameTribute[]) => EventResolution;
}

function createMultiFleeEvent({
  id,
  participantCount,
  weight,
  tags = [],
  fatalCapable = false,
  resolve,
}: MultiFleeEventOptions): EventDefinition {
  return {
    id,
    category: "survival",
    periods: ["day"],
    baseWeight: weight,
    tags: ["survival", "environment", ...(fatalCapable ? (["fatal"] as const) : []), ...tags],
    roles: [
      {
        id: "tributes",
        count: participantCount,
      },
    ],
    resolve(context) {
      const tributes = requireParticipants(context.participantsByRole, "tributes");

      if (tributes.length !== participantCount) {
        throw new Error(`Flee event "${id}" requires exactly ${participantCount} tributes.`);
      }

      return resolve(context, tributes);
    },
  };
}

function createFleeOutcomeChanges(
  eventId: string,
  round: RoundReference,
  survivors: readonly GameTribute[],
  statuses: readonly FleeStatusApplication[] = [],
  additionalChanges: readonly GameChange[] = [],
): GameChange[] {
  return [
    ...statuses.map(({ tribute, statusId, severity, sourceTributeId = null }) =>
      createStatusChange(eventId, tribute, statusId, severity, round, undefined, sourceTributeId),
    ),
    ...additionalChanges,
    ...createSurvivalChanges(survivors),
  ];
}

function createTemporaryTruceChange(
  eventId: string,
  suffix: string,
  round: RoundReference,
  tributes: readonly GameTribute[],
): GameChange {
  return {
    type: "form-truce",
    truce: createTruceInstance(
      `${eventId}:${suffix}`,
      tributes.map((tribute) => tribute.id),
      round,
      STANDARD_TRUCE_EXPIRY_ROUND,
    ),
  };
}

function createStandardVendettaChange(
  eventId: string,
  round: RoundReference,
  hunter: GameTribute,
  target: GameTribute,
): GameChange {
  return {
    type: "form-vendetta",
    vendetta: createVendettaInstance(eventId, hunter.id, target.id, "standard", round),
  };
}

function createSharedFatalChanges(
  victim: GameTribute,
  killers: readonly GameTribute[],
  causeId: string,
  causeLabel: string,
  summary: string,
): GameChange[] {
  return [
    createEliminationChange(
      victim,
      causeId,
      causeLabel,
      summary,
      killers.map((killer) => killer.id),
    ),
    ...killers.flatMap((killer) => [
      createAttemptedKillChange(killer),
      createKillCreditChange(killer),
    ]),
  ];
}

const PAIR_SHOULDER_COLLISION = createMultiFleeEvent({
  id: "bloodbath-flee-pair-shoulder-collision",
  participantCount: 2,
  weight: 3.4,
  tags: ["status"],
  resolve: ({ eventId, round, random }, [first, second]) => {
    const roll = random();
    const baseText =
      `${first.snapshot.name} and ${second.snapshot.name} spot the same ` +
      "morningstar between two supply crates, collide shoulder-first, and " +
      "knock down a wall of supplies with enough force to send them both " +
      "pinwheeling into the woods in completely different directions.";

    if (roll < 0.25) {
      return {
        text: baseText,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: first,
              statusId: "injured",
              severity: 1,
            },
            {
              tribute: second,
              statusId: "injured",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.7) {
      return {
        text: baseText,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: first,
              statusId: "injured",
              severity: 1,
            },
            {
              tribute: second,
              statusId: "disoriented",
              severity: 1,
            },
          ],
        ),
      };
    }

    return {
      text:
        baseText +
        " Luckily, they both land in perfect hiding places while they wait " +
        "for the world to stop spinning.",
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second],
        [
          {
            tribute: first,
            statusId: "hidden",
            severity: 1,
          },
          {
            tribute: second,
            statusId: "hidden",
            severity: 1,
          },
        ],
      ),
    };
  },
});

const PAIR_FOLLOW_ESCAPE_ROUTE = createMultiFleeEvent({
  id: "bloodbath-flee-pair-follow-escape-route",
  participantCount: 2,
  weight: 3.2,
  tags: ["status", "cooperative", "truce"],
  resolve: ({ eventId, round, random }, [leader, follower]) => {
    const roll = random();

    if (roll < 0.3) {
      const text =
        `${follower.snapshot.name} follows ${leader.snapshot.name}'s escape ` +
        "route into the trees, only for the trail to split three times in " +
        "rapid succession. By the time the shouting from the Cornucopia " +
        `stops, ${follower.snapshot.name} is thoroughly lost and ` +
        `${leader.snapshot.name} is nowhere to be seen.`;

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [leader, follower],
          [
            {
              tribute: leader,
              statusId: "hidden",
              severity: 1,
            },
            {
              tribute: follower,
              statusId: "disoriented",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.75) {
      const text =
        `${follower.snapshot.name} notices ${leader.snapshot.name} has found ` +
        "a route through the trees that avoids the worst of the stampede and " +
        "falls into step behind them until finally the shouting from the " +
        "Cornucopia disappears.";

      return {
        text,
        changes: createFleeOutcomeChanges(eventId, round, [leader, follower]),
      };
    }

    const text =
      `${follower.snapshot.name} notices ${leader.snapshot.name} has found ` +
      "a route through the trees that avoids the worst of the thicket and " +
      "falls into step behind them. Once clear, " +
      `${leader.snapshot.name} agrees that two sets of eyes are better than ` +
      "one, and the pair form a temporary truce.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [leader, follower],
        [
          {
            tribute: leader,
            statusId: "hidden",
            severity: 1,
          },
          {
            tribute: follower,
            statusId: "hidden",
            severity: 1,
          },
        ],
        [createTemporaryTruceChange(eventId, "escape-route", round, [leader, follower])],
      ),
    };
  },
});

const PAIR_ANKLE_HOOK = createMultiFleeEvent({
  id: "bloodbath-flee-pair-ankle-hook",
  participantCount: 2,
  weight: 2.9,
  tags: ["status", "ambush"],
  resolve: ({ eventId, round, random }, [tripper, target]) => {
    const roll = random();
    const tripperPronouns = getTributePronouns(tripper);
    const targetPronouns = getTributePronouns(target);

    if (roll < 0.25) {
      const text =
        `${tripper.snapshot.name} tries to hook ${target.snapshot.name}'s ` +
        `ankle while they flee, but catches ${tripper.snapshot.name}'s own ` +
        "foot instead. Both tributes hit the ground, exchange one furious " +
        "look, and scramble away.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [tripper, target],
          [
            {
              tribute: tripper,
              statusId: "injured",
              severity: 1,
            },
            {
              tribute: target,
              statusId: "exhausted",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.8) {
      const text =
        `${tripper.snapshot.name} hooks ${target.snapshot.name}'s ankle and ` +
        `sends ${targetPronouns.object} sprawling, buying enough time to run ` +
        "ahead. The fall hurts, but the embarrassment hurts so much more.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [tripper, target],
          [
            {
              tribute: tripper,
              statusId: "alert",
              severity: 1,
            },
            {
              tribute: target,
              statusId: "injured",
              severity: 1,
              sourceTributeId: tripper.id,
            },
          ],
        ),
      };
    }

    const text =
      `${tripper.snapshot.name} falls ungracefully off ` +
      `${tripperPronouns.possessiveAdjective} podium after the cannon fires. ` +
      `When ${target.snapshot.name} runs past, ${tripper.snapshot.name} ` +
      `reaches for ${targetPronouns.possessiveAdjective} ankle, but ` +
      `${target.snapshot.name} skips over the attempt and kicks ` +
      `${tripper.snapshot.name} hard in the face before fleeing successfully ` +
      "into the woods.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [tripper, target],
        [
          {
            tribute: tripper,
            statusId: "injured",
            severity: 1,
            sourceTributeId: target.id,
          },
          {
            tribute: target,
            statusId: "alert",
            severity: 1,
          },
        ],
      ),
    };
  },
});

const PAIR_SAME_HOLLOW_TREE = createMultiFleeEvent({
  id: "bloodbath-flee-pair-same-hollow-tree",
  participantCount: 2,
  weight: 3.3,
  tags: ["status", "cooperative", "truce"],
  resolve: ({ eventId, round, random }, [first, second]) => {
    const roll = random();

    if (roll < 0.3) {
      const text =
        `${first.snapshot.name} and ${second.snapshot.name} dive into the ` +
        "same hollow tree from opposite sides, become briefly wedged, and in " +
        "their struggle manage to dislodge the log, getting thoroughly " +
        "bruised as they both tumble helplessly through the woods.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: first,
              statusId: "injured",
              severity: 1,
            },
            {
              tribute: second,
              statusId: "injured",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.8) {
      const text =
        `${first.snapshot.name} and ${second.snapshot.name} squeeze into the ` +
        "same hollow tree and hold perfectly still while the Bloodbath rushes " +
        "past. Neither poses any threat while their arms are wedged helplessly " +
        "to their sides, so they pass the time by making threatening faces at " +
        "each other.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: first,
              statusId: "hidden",
              severity: 1,
            },
            {
              tribute: second,
              statusId: "hidden",
              severity: 1,
            },
          ],
        ),
      };
    }

    const text =
      `${first.snapshot.name} and ${second.snapshot.name} squeeze into the ` +
      "same hollow tree and hold perfectly still while the Bloodbath rushes " +
      "past. As they wait until the coast is clear, they begin chatting and " +
      "realize they have more in common than they knew. Once they wiggle " +
      "free, they decide to stick together for a while and watch each other's " +
      "backs.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second],
        [
          {
            tribute: first,
            statusId: "hidden",
            severity: 1,
          },
          {
            tribute: second,
            statusId: "hidden",
            severity: 1,
          },
        ],
        [createTemporaryTruceChange(eventId, "hollow-tree", round, [first, second])],
      ),
    };
  },
});

const PAIR_DECOY_SHOUT = createMultiFleeEvent({
  id: "bloodbath-flee-pair-decoy-shout",
  participantCount: 2,
  weight: 3,
  tags: ["status", "cooperative", "truce"],
  resolve: ({ eventId, round, random }, [decoy, runner]) => {
    const roll = random();
    const runnerPronouns = getTributePronouns(runner);
    const baseText =
      `${decoy.snapshot.name} sees ${runner.snapshot.name} fall on ` +
      `${runnerPronouns.possessiveAdjective} ass shortly after the cannon ` +
      `fires. In a moment of pity, ${decoy.snapshot.name} shouts and crashes ` +
      `through the brush to pull tributes away from ${runner.snapshot.name}.`;

    if (roll < 0.35) {
      return {
        text:
          baseText +
          " The distraction works, although it works a little too " +
          `enthusiastically, as half of the arena now knows exactly where ` +
          `${decoy.snapshot.name} ran.`,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [decoy, runner],
          [
            {
              tribute: decoy,
              statusId: "hunted",
              severity: 1,
            },
            {
              tribute: decoy,
              statusId: "exhausted",
              severity: 1,
            },
            {
              tribute: runner,
              statusId: "hidden",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.85) {
      return {
        text:
          baseText +
          " The distraction works, and once the danger passes, the pair " +
          "regroup farther into the woods.",
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [decoy, runner],
          [],
          [createTemporaryTruceChange(eventId, "decoy-regroup", round, [decoy, runner])],
        ),
      };
    }

    return {
      text:
        baseText +
        " Once the danger passes, the pair regroup farther into the woods " +
        "and find a hiding spot where they can both be concealed.",
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [decoy, runner],
        [
          {
            tribute: decoy,
            statusId: "hidden",
            severity: 1,
          },
          {
            tribute: runner,
            statusId: "hidden",
            severity: 1,
          },
        ],
        [createTemporaryTruceChange(eventId, "decoy-hideout", round, [decoy, runner])],
      ),
    };
  },
});

const PAIR_RAVINE_ROUTE_ARGUMENT = createMultiFleeEvent({
  id: "bloodbath-flee-pair-ravine-route-argument",
  participantCount: 2,
  weight: 2.8,
  tags: ["status"],
  resolve: ({ eventId, round, random }, [first, second]) => {
    const roll = random();
    const secondPronouns = getTributePronouns(second);
    const baseText =
      `${first.snapshot.name} and ${second.snapshot.name} choose similar ` +
      "paths through the woods and together come across a fork beside a " +
      "ravine, where they begin loudly arguing over which route is less " +
      "likely to end in immediate death.";

    if (roll < 0.5) {
      return {
        text:
          baseText +
          " They choose different paths, and both immediately decide that " +
          "their own route was worse.",
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: first,
              statusId: "exhausted",
              severity: 1,
            },
            {
              tribute: second,
              statusId: "disoriented",
              severity: 1,
            },
          ],
        ),
      };
    }

    return {
      text:
        baseText +
        ` ${first.snapshot.name} spots fresh footprints and persuades ` +
        `${second.snapshot.name} to travel along that route, hoping that ` +
        `${secondPronouns.subject} will be caught by whoever went that way first.`,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second],
        [
          {
            tribute: first,
            statusId: "alert",
            severity: 1,
          },
        ],
      ),
    };
  },
});

const PAIR_FALLEN_LOG_COOPERATION = createMultiFleeEvent({
  id: "bloodbath-flee-pair-fallen-log-cooperation",
  participantCount: 2,
  weight: 3.1,
  tags: ["status", "cooperative", "truce", "ambush"],
  fatalCapable: true,
  resolve: ({ eventId, round, random }, [first, second]) => {
    const roll = random();
    const firstPronouns = getTributePronouns(first);
    const baseText =
      `${first.snapshot.name} beelines for the forest but quickly comes ` +
      `across a large fallen log blocking ${firstPronouns.possessiveAdjective} ` +
      `path. Before ${firstPronouns.subject} can decide what to do, ` +
      `${second.snapshot.name} arrives and suggests they each take turns ` +
      "holding the log up so that they can both make it to safety.";

    if (roll < 0.13) {
      return {
        text:
          baseText +
          ` ${first.snapshot.name} agrees suspiciously and holds the log ` +
          `first to allow ${second.snapshot.name} to crawl under, who then ` +
          "immediately disappears into the woods, leaving " +
          `${first.snapshot.name} alone and frustrated.`,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: second,
              statusId: "hidden",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.25) {
      return {
        text:
          baseText +
          ` ${first.snapshot.name} agrees so long as ${second.snapshot.name} ` +
          `holds the log first. As soon as ${first.snapshot.name} is safely ` +
          `on the other side, ${firstPronouns.subject} runs into the trees, ` +
          `leaving ${second.snapshot.name} standing there holding the log like a schmuck.`,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second],
          [
            {
              tribute: first,
              statusId: "hidden",
              severity: 1,
            },
          ],
        ),
      };
    }

    if (roll < 0.37) {
      const text =
        baseText +
        ` ${first.snapshot.name} agrees suspiciously and holds the log ` +
        `first to allow ${second.snapshot.name} to crawl under. ` +
        `${second.snapshot.name} carefully takes the weight of the hefty log ` +
        `from ${first.snapshot.name}, then lets it come crashing down while ` +
        `${first.snapshot.name} is only halfway underneath.`;

      return {
        text,
        changes: [
          ...createFatalChanges(
            first,
            "bloodbath-flee-pair-fallen-log-cooperation",
            "Crushed beneath a deliberately dropped log",
            text,
            second,
          ),
          ...createSurvivalChanges([second]),
        ],
      };
    }

    if (roll < 0.5) {
      const text =
        baseText +
        ` ${first.snapshot.name} agrees so long as ${second.snapshot.name} ` +
        `holds the log first. ${first.snapshot.name} quickly ducks under and, ` +
        `as promised, takes the weight so ${second.snapshot.name} can follow. ` +
        `Seizing the opportunity, ${first.snapshot.name} lets the log come ` +
        `crashing down on ${second.snapshot.name}, ending their temporary ` +
        "cooperation in bloody betrayal.";

      return {
        text,
        changes: [
          ...createFatalChanges(
            second,
            "bloodbath-flee-pair-fallen-log-cooperation",
            "Crushed beneath a deliberately dropped log",
            text,
            first,
          ),
          ...createSurvivalChanges([first]),
        ],
      };
    }

    return {
      text:
        baseText +
        " Despite suspicious glances, both hold up their ends of the " +
        "agreement and decide they can trust each other, at least temporarily.",
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second],
        [],
        [createTemporaryTruceChange(eventId, "fallen-log", round, [first, second])],
      ),
    };
  },
});

const PAIR_ABANDONED_AT_CREEK = createMultiFleeEvent({
  id: "bloodbath-flee-pair-abandoned-at-creek",
  participantCount: 2,
  weight: 0.45,
  tags: ["status", "ambush"],
  fatalCapable: true,
  resolve: ({ eventId, round, random }, [betrayer, target]) => {
    const roll = random();
    const targetPronouns = getTributePronouns(target);
    const baseText =
      `${target.snapshot.name} runs into the woods and comes across a raging ` +
      `river with ${betrayer.snapshot.name} a few feet from the opposite edge.`;

    if (roll < 0.5) {
      const text =
        baseText +
        ` ${betrayer.snapshot.name} offers ${target.snapshot.name} a hand ` +
        `across, waits until the current has ${targetPronouns.object} off ` +
        `balance, and lets go. ${target.snapshot.name} is swept beneath a ` +
        "tangle of roots and does not resurface.";

      return {
        text,
        changes: [
          ...createFatalChanges(
            target,
            "bloodbath-flee-pair-abandoned-at-creek",
            "Betrayed while crossing a river",
            text,
            betrayer,
          ),
          ...createSurvivalChanges([betrayer]),
        ],
      };
    }

    const text =
      baseText +
      ` ${betrayer.snapshot.name} promises to help ${target.snapshot.name} ` +
      `across, then bolts the moment ${targetPronouns.subject} ` +
      `${targetPronouns.bePresent} waist-deep in the current. Luckily, ` +
      `${target.snapshot.name} has just enough strength to pull ` +
      `${targetPronouns.reflexive} back out, swearing to catch up to ` +
      `${betrayer.snapshot.name} as soon as ${targetPronouns.subject} ` +
      `${targetPronouns.havePresent} caught ${targetPronouns.possessiveAdjective} breath.`;

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [betrayer, target],
        [
          {
            tribute: betrayer,
            statusId: "hidden",
            severity: 1,
          },
          {
            tribute: target,
            statusId: "injured",
            severity: 1,
            sourceTributeId: betrayer.id,
          },
        ],
        [createStandardVendettaChange(eventId, round, target, betrayer)],
      ),
    };
  },
});

const TRIO_NARROW_DEER_PATH = createMultiFleeEvent({
  id: "bloodbath-flee-trio-narrow-deer-path",
  participantCount: 3,
  weight: 3.4,
  tags: ["status", "ambush", "truce"],
  fatalCapable: true,
  resolve: ({ eventId, round, random }, [first, second, third]) => {
    const roll = random();
    const firstPronouns = getTributePronouns(first);
    const secondPronouns = getTributePronouns(second);
    const thirdPronouns = getTributePronouns(third);
    const baseText =
      `${first.snapshot.name} runs wildly into the woods, not looking back ` +
      `at the stampede of tributes running for the supplies. After several ` +
      `minutes, ${firstPronouns.subject} comes across a wall of thick thorn ` +
      `bushes and hesitates, unable to find a path forward. Then ` +
      `${second.snapshot.name} arrives from the woods, and after an awkward ` +
      `moment, ${third.snapshot.name} crashes through as well.`;

    if (roll < 0.3) {
      return {
        text:
          baseText +
          " The three tributes lunge at each other, all ending up thoroughly " +
          "scraped and stabbed by the bushes before finally separating and " +
          "disappearing back into the trees.",
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second, third],
          [first, second, third].map((tribute) => ({
            tribute,
            statusId: "injured" as const,
            severity: 1 as const,
          })),
        ),
      };
    }

    if (roll < 0.85) {
      return {
        text:
          baseText +
          ` The tension breaks when ${third.snapshot.name} slowly moves ` +
          "through the bushes, revealing a path forward for the other two. " +
          "Everyone separates on the other side.",
        changes: createFleeOutcomeChanges(eventId, round, [first, second, third]),
      };
    }

    if (roll < 0.9) {
      const text =
        baseText +
        ` ${first.snapshot.name} barely has a moment to breathe before being ` +
        `swarmed by ${second.snapshot.name} and ${third.snapshot.name}, trapped ` +
        `against the wall of thorns with nowhere to run. The duo finish off ` +
        `${first.snapshot.name} with a deadly twist of ` +
        `${firstPronouns.possessiveAdjective} head before running back into the woods together.`;

      return {
        text,
        changes: [
          ...createSharedFatalChanges(
            first,
            [second, third],
            "bloodbath-flee-trio-narrow-deer-path",
            "Killed against a wall of thorns",
            text,
          ),
          ...createFleeOutcomeChanges(
            eventId,
            round,
            [second, third],
            [],
            [createTemporaryTruceChange(eventId, "thorn-duo", round, [second, third])],
          ),
        ],
      };
    }

    if (roll < 0.95) {
      const text =
        baseText +
        ` ${third.snapshot.name} nods at ${first.snapshot.name}, and together ` +
        `they lunge at ${second.snapshot.name}, who is stuck against the wall ` +
        `of thorns. Together they suffocate ${secondPronouns.object} before ` +
        "amicably breaking up and running back into the woods.";

      return {
        text,
        changes: [
          ...createSharedFatalChanges(
            second,
            [first, third],
            "bloodbath-flee-trio-narrow-deer-path",
            "Suffocated against a wall of thorns",
            text,
          ),
          ...createSurvivalChanges([first, third]),
        ],
      };
    }

    const text =
      baseText +
      ` ${second.snapshot.name} nods at ${first.snapshot.name}, and together ` +
      `they lunge at ${third.snapshot.name}, who is stuck against the wall ` +
      `of thorns. Together they wrap a thorny branch around ` +
      `${thirdPronouns.possessiveAdjective} throat, suffocating ` +
      `${thirdPronouns.object}, before amicably breaking up and running back into the woods.`;

    return {
      text,
      changes: [
        ...createSharedFatalChanges(
          third,
          [first, second],
          "bloodbath-flee-trio-narrow-deer-path",
          "Strangled with a thorny branch",
          text,
        ),
        ...createSurvivalChanges([first, second]),
      ],
    };
  },
});

const TRIO_USE_THIRD_AS_DECOY = createMultiFleeEvent({
  id: "bloodbath-flee-trio-use-third-as-decoy",
  participantCount: 3,
  weight: 2.9,
  tags: ["status", "ambush", "truce"],
  fatalCapable: true,
  resolve: ({ eventId, round, random }, [first, second, decoy]) => {
    const roll = random();
    const decoyPronouns = getTributePronouns(decoy);
    const baseText =
      `${first.snapshot.name} bolts from the podium and grabs ` +
      `${second.snapshot.name}'s hand, together clotheslining ` +
      `${decoy.snapshot.name} and flipping ${decoyPronouns.object} onto ` +
      `${decoyPronouns.possessiveAdjective} ass`;

    if (roll < 0.5) {
      return {
        text: baseText + " before the duo disappear together into the trees.",
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second, decoy],
          [
            {
              tribute: decoy,
              statusId: "injured",
              severity: 1,
              sourceTributeId: first.id,
            },
          ],
          [createTemporaryTruceChange(eventId, "clothesline-duo", round, [first, second])],
        ),
      };
    }

    const text =
      baseText +
      ", directly in front of the stampede of panicked, bloodthirsty " +
      `tributes. By the time ${first.snapshot.name} and ${second.snapshot.name} ` +
      `make it to the trees, ${decoy.snapshot.name} is nothing more than a stain on the grass.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          decoy,
          "bloodbath-flee-trio-use-third-as-decoy",
          "Clotheslined into the Bloodbath stampede",
          text,
          first,
        ),
        ...createSurvivalChanges([first, second]),
      ],
    };
  },
});

const TRIO_ESCAPE_GROUP_FRACTURES = createMultiFleeEvent({
  id: "bloodbath-flee-trio-escape-group-fractures",
  participantCount: 3,
  weight: 3,
  tags: ["status", "cooperative", "truce"],
  resolve: ({ eventId, round, random }, [first, second, third]) => {
    const roll = random();

    if (roll < 0.4) {
      const text =
        `${first.snapshot.name}, ${second.snapshot.name}, and ` +
        `${third.snapshot.name} agree to flee together, then reach the first ` +
        "fork in the trail and immediately split three different ways while " +
        "each insists the others are making a terrible mistake.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second, third],
          [
            {
              tribute: first,
              statusId: "disoriented",
              severity: 1,
            },
            {
              tribute: second,
              statusId: "exhausted",
              severity: 1,
            },
            {
              tribute: third,
              statusId: "alert",
              severity: 1,
            },
          ],
        ),
      };
    }

    const text =
      `${first.snapshot.name}, ${second.snapshot.name}, and ` +
      `${third.snapshot.name} form a temporary escape group, running through ` +
      "the woods while holding hands until the sounds of the Cornucopia fade.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second, third],
        [],
        [createTemporaryTruceChange(eventId, "trio-escape", round, [first, second, third])],
      ),
    };
  },
});

const TRIO_BRAMBLE_HIDEOUT = createMultiFleeEvent({
  id: "bloodbath-flee-trio-bramble-hideout",
  participantCount: 3,
  weight: 3.2,
  tags: ["status", "cooperative", "truce"],
  resolve: ({ eventId, round, random }, [first, second, third]) => {
    const roll = random();
    const firstPronouns = getTributePronouns(first);

    if (roll < 0.35) {
      const text =
        `${first.snapshot.name} runs wildly away from the clearing, quickly ` +
        `finding a bramble patch to hide beneath. Much to ` +
        `${firstPronouns.possessiveAdjective} surprise, ` +
        `${second.snapshot.name} and ${third.snapshot.name} are already ` +
        `hiding there. After a momentary pause, ${third.snapshot.name} begins ` +
        `screaming like a banshee, causing ${first.snapshot.name} and ` +
        `${second.snapshot.name} to scramble painfully back through the ` +
        "brambles and continue searching for a new hiding place.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second, third],
          [
            {
              tribute: third,
              statusId: "hidden",
              severity: 1,
            },
          ],
        ),
      };
    }

    const text =
      `${first.snapshot.name} runs wildly away from the clearing, quickly ` +
      `finding a bramble patch to hide beneath. Much to ` +
      `${firstPronouns.possessiveAdjective} surprise, ${second.snapshot.name} ` +
      `and ${third.snapshot.name} are already hiding there. Unsure what to do, ` +
      `${first.snapshot.name} hears several tributes approaching, and all ` +
      "three hold their breath until the coast is clear. Afterwards, they " +
      "decide it is best to stick together, although they head back out to " +
      "find a less pokey hiding place.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second, third],
        [first, second, third].map((tribute) => ({
          tribute,
          statusId: "hidden" as const,
          severity: 1 as const,
        })),
        [createTemporaryTruceChange(eventId, "bramble-group", round, [first, second, third])],
      ),
    };
  },
});

const TRIO_REDIRECT_PURSUIT = createMultiFleeEvent({
  id: "bloodbath-flee-trio-redirect-pursuit",
  participantCount: 3,
  weight: 2.8,
  tags: ["cooperative", "truce"],
  resolve: ({ eventId, round }, [first, second, third]) => {
    const firstPronouns = getTributePronouns(first);
    const secondPronouns = getTributePronouns(second);
    const text =
      `${first.snapshot.name} leaps off ${firstPronouns.possessiveAdjective} ` +
      `platform and notices ${firstPronouns.possessiveAdjective} neighbour, ` +
      `${second.snapshot.name}, swan-dive straight into the ground, landing ` +
      "stunned in front of the oncoming stampede. Not willing to leave " +
      `${secondPronouns.object} behind, ${first.snapshot.name} sprints forward ` +
      `and hooks an arm beneath ${second.snapshot.name}, only to realize, to ` +
      `${firstPronouns.possessiveAdjective} surprise, that ` +
      `${third.snapshot.name} had the same idea. Together, they pull ` +
      `${second.snapshot.name} to safety and disappear into the woods, ` +
      "silently agreeing to stick together, at least for a while.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second, third],
        [],
        [createTemporaryTruceChange(eventId, "untrampled", round, [first, second, third])],
      ),
    };
  },
});

const TRIO_RAVINE_BETRAYAL = createMultiFleeEvent({
  id: "bloodbath-flee-trio-ravine-betrayal",
  participantCount: 3,
  weight: 0.4,
  tags: ["ambush", "truce"],
  fatalCapable: true,
  resolve: ({ eventId, round, random }, [betrayer, target, witness]) => {
    const roll = random();
    const betrayerPronouns = getTributePronouns(betrayer);
    const targetPronouns = getTributePronouns(target);
    const witnessPronouns = getTributePronouns(witness);
    const baseText =
      `${betrayer.snapshot.name}, ${target.snapshot.name}, and ` +
      `${witness.snapshot.name} all agree to travel together. In their ` +
      "search for a safe hiding place, they come across a narrow ravine ledge.";

    if (roll < 0.4) {
      const text =
        baseText +
        ` As they attempt to cross, ${betrayer.snapshot.name} shoulder-checks ` +
        `${target.snapshot.name}, sending ${targetPronouns.object} screaming ` +
        `over the edge to ${targetPronouns.possessiveAdjective} demise. ` +
        `${witness.snapshot.name} escapes before ${betrayer.snapshot.name} ` +
        `has a chance to grab ${witnessPronouns.object} as well.`;

      return {
        text,
        changes: [
          ...createFatalChanges(
            target,
            "bloodbath-flee-trio-ravine-betrayal",
            "Pushed from a ravine ledge by an ally",
            text,
            betrayer,
          ),
          ...createSurvivalChanges([betrayer, witness]),
        ],
      };
    }

    if (roll < 0.7) {
      const text =
        baseText +
        ` As they carefully cross, ${betrayer.snapshot.name} tries to ` +
        `shoulder-check ${target.snapshot.name}, but stumbles and instead ` +
        `sends ${betrayerPronouns.reflexive} screaming over the edge to ` +
        `${betrayerPronouns.possessiveAdjective} demise. ` +
        `${witness.snapshot.name} and ${target.snapshot.name} stare at each ` +
        "other in stunned silence before making it carefully to the other side.";

      return {
        text,
        changes: [
          ...createFatalChanges(
            betrayer,
            "bloodbath-flee-trio-ravine-betrayal",
            "Fell from a ravine during a failed betrayal",
            text,
          ),
          ...createFleeOutcomeChanges(
            eventId,
            round,
            [target, witness],
            [],
            [
              createTemporaryTruceChange(eventId, "failed-betrayal-survivors", round, [
                target,
                witness,
              ]),
            ],
          ),
        ],
      };
    }

    if (roll < 0.85) {
      const text =
        baseText +
        ` As they carefully cross, ${target.snapshot.name} loses ` +
        `${targetPronouns.possessiveAdjective} footing and tries to grab ` +
        `${betrayer.snapshot.name}'s arm, but ${betrayerPronouns.subject} ` +
        `dodges, letting ${target.snapshot.name} fall to ` +
        `${targetPronouns.possessiveAdjective} demise. ` +
        `${witness.snapshot.name} and ${betrayer.snapshot.name} stare at each ` +
        "other in stunned silence before making it carefully to the other side.";

      return {
        text,
        changes: [
          ...createFatalChanges(
            target,
            "bloodbath-flee-trio-ravine-betrayal",
            "Denied help while falling from a ravine",
            text,
          ),
          ...createFleeOutcomeChanges(
            eventId,
            round,
            [betrayer, witness],
            [],
            [
              createTemporaryTruceChange(eventId, "unwilling-survivors", round, [
                betrayer,
                witness,
              ]),
            ],
          ),
        ],
      };
    }

    if (roll < 0.95) {
      const text =
        baseText +
        ` As they carefully cross, ${target.snapshot.name} loses ` +
        `${targetPronouns.possessiveAdjective} footing and tries to grab ` +
        `${betrayer.snapshot.name}'s arm, but ${betrayerPronouns.subject} ` +
        `dodges, letting ${target.snapshot.name} fall to ` +
        `${targetPronouns.possessiveAdjective} demise. ` +
        `${witness.snapshot.name} and ${betrayer.snapshot.name} stare at each ` +
        `other in stunned silence before ${betrayer.snapshot.name} pushes ` +
        `${witness.snapshot.name} off the ledge too, for good measure.`;

      return {
        text,
        changes: [
          ...createFatalChanges(
            target,
            "bloodbath-flee-trio-ravine-betrayal",
            "Denied help while falling from a ravine",
            text,
            betrayer,
          ),
          ...createFatalChanges(
            witness,
            "bloodbath-flee-trio-ravine-betrayal",
            "Pushed from a ravine ledge",
            text,
            betrayer,
          ),
          ...createSurvivalChanges([betrayer]),
        ],
      };
    }

    const text =
      baseText +
      ` As they carefully cross, ${target.snapshot.name} loses ` +
      `${targetPronouns.possessiveAdjective} footing and manages to grab ` +
      `${betrayer.snapshot.name}'s arm, pulling ${betrayerPronouns.object} ` +
      `off balance as well. As ${betrayer.snapshot.name} begins to fall, ` +
      `${betrayerPronouns.subject} reaches out and grabs ` +
      `${witness.snapshot.name} by the shirt, and all three tumble to their demise.`;

    return {
      text,
      changes: [
        ...createFatalChanges(
          target,
          "bloodbath-flee-trio-ravine-betrayal",
          "Fell from a ravine in a chain reaction",
          text,
        ),
        ...createFatalChanges(
          betrayer,
          "bloodbath-flee-trio-ravine-betrayal",
          "Pulled from a ravine ledge",
          text,
          target,
        ),
        ...createFatalChanges(
          witness,
          "bloodbath-flee-trio-ravine-betrayal",
          "Dragged from a ravine ledge",
          text,
          betrayer,
        ),
      ],
    };
  },
});

const QUARTET_SCREE_SLOPE_STAMPEDE = createMultiFleeEvent({
  id: "bloodbath-flee-quartet-scree-slope-stampede",
  participantCount: 4,
  weight: 3.6,
  tags: ["status"],
  resolve: ({ eventId, round, random }, [first, second, third, fourth]) => {
    const roll = random();
    const text =
      `${first.snapshot.name}, ${second.snapshot.name}, ` +
      `${third.snapshot.name}, and ${fourth.snapshot.name} all race into the ` +
      "woods. Uncertain who is chasing whom, everyone tumbles down the same " +
      "cliff in confusion, each landing with several bumps and scrapes but no " +
      "fatalities. Shocked back to reality, the tributes all go their separate ways.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second, third, fourth],
        [first, second, third, fourth].map((tribute) => ({
          tribute,
          statusId: (roll < 0.3 ? "injured" : "exhausted") as StatusEffectId,
          severity: 1 as const,
        })),
      ),
    };
  },
});

const QUARTET_COMPETING_PAIRS = createMultiFleeEvent({
  id: "bloodbath-flee-quartet-competing-pairs",
  participantCount: 4,
  weight: 3,
  tags: ["status", "cooperative", "truce"],
  resolve: ({ eventId, round, random }, [first, second, third, fourth]) => {
    const roll = random();
    const text =
      `${first.snapshot.name}, ${second.snapshot.name}, ` +
      `${third.snapshot.name}, and ${fourth.snapshot.name} flee together into ` +
      "the woods, running in panicked silence until the trail splits. Without " +
      "discussion, the group divides into two pairs, and each pair becomes " +
      "absolutely certain the other chose badly.";

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second, third, fourth],
        roll < 0.3
          ? [
              {
                tribute: first,
                statusId: "exhausted",
                severity: 1,
              },
              {
                tribute: second,
                statusId: "exhausted",
                severity: 1,
              },
              {
                tribute: third,
                statusId: "alert",
                severity: 1,
              },
              {
                tribute: fourth,
                statusId: "alert",
                severity: 1,
              },
            ]
          : [],
        [
          createTemporaryTruceChange(eventId, "pair-a", round, [first, second]),
          createTemporaryTruceChange(eventId, "pair-b", round, [third, fourth]),
        ],
      ),
    };
  },
});

const QUARTET_ROPE_BRIDGE_CHAIN_REACTION = createMultiFleeEvent({
  id: "bloodbath-flee-quartet-rope-bridge-chain-reaction",
  participantCount: 4,
  weight: 0.35,
  tags: ["status"],
  fatalCapable: true,
  resolve: ({ eventId, round, random }, [first, second, third, fourth]) => {
    const roll = random();

    if (roll < 0.06) {
      const text =
        `${first.snapshot.name}, ${second.snapshot.name}, ` +
        `${third.snapshot.name}, and ${fourth.snapshot.name} crowd onto a ` +
        "rotting rope bridge. One plank snaps, everyone lunges for the same " +
        `support rope, and ${fourth.snapshot.name} is knocked into the gorge below.`;

      return {
        text,
        changes: [
          ...createFatalChanges(
            fourth,
            "bloodbath-flee-quartet-rope-bridge-chain-reaction",
            "Knocked from a collapsing rope bridge",
            text,
          ),
          ...createSurvivalChanges([first, second, third]),
        ],
      };
    }

    if (roll < 0.85) {
      const text =
        `${first.snapshot.name}, ${second.snapshot.name}, ` +
        `${third.snapshot.name}, and ${fourth.snapshot.name} overload a ` +
        "rotting rope bridge. The bridge twists sideways, dumping all four " +
        "tributes onto the far bank in a heap just before it collapses.";

      return {
        text,
        changes: createFleeOutcomeChanges(
          eventId,
          round,
          [first, second, third, fourth],
          [first, second, third, fourth].map((tribute) => ({
            tribute,
            statusId: "injured" as const,
            severity: 1 as const,
          })),
        ),
      };
    }

    const text =
      `${first.snapshot.name}, ${second.snapshot.name}, ` +
      `${third.snapshot.name}, and ${fourth.snapshot.name} overload a ` +
      "rotting rope bridge. The bridge twists sideways, dumping all except " +
      `${fourth.snapshot.name} onto the far bank in a heap, allowing ` +
      `${fourth.snapshot.name} to continue running to safety.`;

    return {
      text,
      changes: createFleeOutcomeChanges(
        eventId,
        round,
        [first, second, third, fourth],
        [
          {
            tribute: first,
            statusId: "injured",
            severity: 1,
          },
          {
            tribute: second,
            statusId: "injured",
            severity: 1,
          },
          {
            tribute: third,
            statusId: "injured",
            severity: 1,
          },
          {
            tribute: fourth,
            statusId: "lucky",
            severity: 1,
          },
        ],
      ),
    };
  },
});

export const PAIR_FLEE_EVENTS = [
  PAIR_SHOULDER_COLLISION,
  PAIR_FOLLOW_ESCAPE_ROUTE,
  PAIR_ANKLE_HOOK,
  PAIR_SAME_HOLLOW_TREE,
  PAIR_DECOY_SHOUT,
  PAIR_RAVINE_ROUTE_ARGUMENT,
  PAIR_FALLEN_LOG_COOPERATION,
  PAIR_ABANDONED_AT_CREEK,
] satisfies readonly EventDefinition[];

export const TRIO_FLEE_EVENTS = [
  TRIO_NARROW_DEER_PATH,
  TRIO_USE_THIRD_AS_DECOY,
  TRIO_ESCAPE_GROUP_FRACTURES,
  TRIO_BRAMBLE_HIDEOUT,
  TRIO_REDIRECT_PURSUIT,
  TRIO_RAVINE_BETRAYAL,
] satisfies readonly EventDefinition[];

export const QUARTET_FLEE_EVENTS = [
  QUARTET_SCREE_SLOPE_STAMPEDE,
  QUARTET_COMPETING_PAIRS,
  QUARTET_ROPE_BRIDGE_CHAIN_REACTION,
] satisfies readonly EventDefinition[];

export const MULTI_PARTICIPANT_FLEE_EVENTS = [
  ...PAIR_FLEE_EVENTS,
  ...TRIO_FLEE_EVENTS,
  ...QUARTET_FLEE_EVENTS,
] satisfies readonly EventDefinition[];
