import { createSeededRandom } from "~/game/engine/random";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import {
  createVendettaInstance,
  ROMANTIC_VENDETTA_CHANCE,
  STANDARD_VENDETTA_CHANCE,
} from "~/game/truces/vendetta-engine";
import type {
  GameChange,
  GameState,
  GameTribute,
  ResolvedEvent,
  Truce,
} from "~/game/types/game-state";
import { getTributePronouns } from "~/game/tributes/pronouns";

interface DeathResponse {
  changes: GameChange[];
  text: string;
  participantTributeIds: string[];
}

function formatNameList(names: readonly string[]): string {
  if (names.length === 0) {
    return "the missing tributes";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, and ` + names[names.length - 1];
}

function getTributeName(state: GameState, tributeId: string): string {
  return (
    state.tributes.find((tribute) => tribute.id === tributeId)?.snapshot.name ??
    "an unknown tribute"
  );
}

function getLivingTruceMembers(state: GameState, truce: Truce): GameTribute[] {
  return truce.tributeIds.flatMap((tributeId) => {
    const tribute = state.tributes.find(
      (candidate) => candidate.id === tributeId && candidate.isAlive,
    );

    return tribute ? [tribute] : [];
  });
}

function getLivingKillersForTruceDeaths(
  state: GameState,
  primaryEvent: ResolvedEvent,
  truce: Truce,
): GameTribute[] {
  const killerIds = new Set(
    primaryEvent.changes.flatMap((change) => {
      if (change.type !== "eliminate-tribute" || !truce.tributeIds.includes(change.tributeId)) {
        return [];
      }

      return change.killerTributeIds;
    }),
  );

  return [...killerIds].flatMap((killerId) => {
    const killer = state.tributes.find((tribute) => tribute.id === killerId && tribute.isAlive);

    return killer ? [killer] : [];
  });
}

function createAccidentalDissolutionText(
  beforeState: GameState,
  afterState: GameState,
  truce: Truce,
  eliminatedTributeIds: ReadonlySet<string>,
): string {
  if (truce.kind === "romantic") {
    return createRomanticDissolutionText(beforeState, afterState, truce, eliminatedTributeIds);
  }

  const eliminatedMemberNames = truce.tributeIds
    .filter((tributeId) => eliminatedTributeIds.has(tributeId))
    .map((tributeId) => getTributeName(beforeState, tributeId));

  const survivingMembers = getLivingTruceMembers(afterState, truce);

  const survivingMemberNames = survivingMembers.map((tribute) => tribute.snapshot.name);

  const eliminatedNames = formatNameList(eliminatedMemberNames);

  if (survivingMemberNames.length === 0) {
    return `The deaths of ${eliminatedNames} ` + "bring their truce to an abrupt end.";
  }

  if (survivingMembers.length === 1) {
    const survivor = survivingMembers[0];

    if (!survivor) {
      throw new Error("Missing surviving truce member.");
    }

    const survivorPronouns = getTributePronouns(survivor);

    return (
      `With ${eliminatedNames} dead, ` +
      `${survivor.snapshot.name} is left ` +
      `on ${survivorPronouns.possessiveAdjective} own. ` +
      "The truce ends abruptly."
    );
  }

  return (
    `The death of ${eliminatedNames} brings ` +
    "the truce to an abrupt end. " +
    `${formatNameList(survivingMemberNames)} ` +
    "go their separate ways."
  );
}

function createRomanticDissolutionText(
  beforeState: GameState,
  afterState: GameState,
  truce: Truce,
  eliminatedTributeIds: ReadonlySet<string>,
): string {
  const eliminatedNames = truce.tributeIds
    .filter((tributeId) => eliminatedTributeIds.has(tributeId))
    .map((tributeId) => getTributeName(beforeState, tributeId));

  const survivingNames = getLivingTruceMembers(afterState, truce).map(
    (tribute) => tribute.snapshot.name,
  );

  if (survivingNames.length === 0) {
    return (
      `${formatNameList(eliminatedNames)} ` +
      "die together. Their promise ends " +
      "only when they do."
    );
  }

  return (
    `With ${formatNameList(eliminatedNames)} dead, ` +
    `${survivingNames[0]} is devastated. ` +
    "Their romantic truce ends only because " +
    "the arena has torn them apart."
  );
}

function rollsForVendetta(
  state: GameState,
  primaryEvent: ResolvedEvent,
  truce: Truce,
  hunterTributeId: string,
  targetTributeIds: readonly string[],
  chance: number,
): boolean {
  const random = createSeededRandom(
    [
      state.seed,
      "vendetta-response",
      primaryEvent.id,
      truce.id,
      hunterTributeId,
      ...targetTributeIds,
    ].join(":"),
  );

  return random() < chance;
}

function createDisorientedResponse(
  aftermathEventId: string,
  survivor: GameTribute,
  primaryEvent: ResolvedEvent,
): DeathResponse {
  return {
    changes: [
      {
        type: "apply-status",

        tributeId: survivor.id,

        status: createStatusEffectInstance(
          aftermathEventId,
          survivor.id,
          "disoriented",
          2,
          primaryEvent.round,
        ),
      },
    ],

    text: `${survivor.snapshot.name} is overcome ` + "by grief and becomes disoriented.",

    participantTributeIds: [],
  };
}

function createVendettaResponse(
  aftermathEventId: string,
  primaryEvent: ResolvedEvent,
  hunter: GameTribute,
  targets: readonly GameTribute[],
  kind: Truce["kind"],
): DeathResponse {
  const changes: GameChange[] = targets.map((target) => ({
    type: "form-vendetta",

    vendetta: createVendettaInstance(
      aftermathEventId,
      hunter.id,
      target.id,
      kind,
      primaryEvent.round,
    ),
  }));

  const hunterPronouns = getTributePronouns(hunter);

  return {
    changes,

    text:
      `${hunter.snapshot.name} turns ` +
      `${hunterPronouns.possessiveAdjective} grief into vengeance ` +
      "and swears to hunt " +
      `${formatNameList(targets.map((target) => target.snapshot.name))} down.`,

    participantTributeIds: targets.map((target) => target.id),
  };
}

function createRomanticDeathResponse(
  beforeState: GameState,
  afterState: GameState,
  primaryEvent: ResolvedEvent,
  truce: Truce,
  aftermathEventId: string,
): DeathResponse {
  const survivor = getLivingTruceMembers(afterState, truce)[0];

  if (!survivor) {
    return {
      changes: [],
      text: "",
      participantTributeIds: [],
    };
  }

  const killers = getLivingKillersForTruceDeaths(afterState, primaryEvent, truce).filter(
    (killer) => killer.id !== survivor.id,
  );

  if (killers.length === 0) {
    return createDisorientedResponse(aftermathEventId, survivor, primaryEvent);
  }

  const becomesVengeful = rollsForVendetta(
    beforeState,
    primaryEvent,
    truce,
    survivor.id,
    killers.map((killer) => killer.id),
    ROMANTIC_VENDETTA_CHANCE,
  );

  if (!becomesVengeful) {
    return createDisorientedResponse(aftermathEventId, survivor, primaryEvent);
  }

  return createVendettaResponse(aftermathEventId, primaryEvent, survivor, killers, "romantic");
}

function createStandardDeathResponse(
  beforeState: GameState,
  afterState: GameState,
  primaryEvent: ResolvedEvent,
  truce: Truce,
  aftermathEventId: string,
): DeathResponse {
  const killers = getLivingKillersForTruceDeaths(afterState, primaryEvent, truce);

  if (killers.length === 0) {
    return {
      changes: [],
      text: "",
      participantTributeIds: [],
    };
  }

  const responses = getLivingTruceMembers(afterState, truce).flatMap((survivor) => {
    const eligibleKillers = killers.filter((killer) => killer.id !== survivor.id);

    if (eligibleKillers.length === 0) {
      return [];
    }

    const formsVendetta = rollsForVendetta(
      beforeState,
      primaryEvent,
      truce,
      survivor.id,
      eligibleKillers.map((killer) => killer.id),
      STANDARD_VENDETTA_CHANCE,
    );

    if (!formsVendetta) {
      return [];
    }

    return [
      createVendettaResponse(aftermathEventId, primaryEvent, survivor, eligibleKillers, "standard"),
    ];
  });

  return {
    changes: responses.flatMap((response) => response.changes),

    text: responses.map((response) => response.text).join(" "),

    participantTributeIds: responses.flatMap((response) => response.participantTributeIds),
  };
}

export function createAccidentalTruceDissolutionEvents(
  beforeState: GameState,
  afterPrimaryEventState: GameState,
  primaryEvent: ResolvedEvent,
): ResolvedEvent[] {
  const eliminatedTributeIds = new Set(
    primaryEvent.changes.flatMap((change) =>
      change.type === "eliminate-tribute" ? [change.tributeId] : [],
    ),
  );

  if (eliminatedTributeIds.size === 0) {
    return [];
  }

  const explicitlyBrokenTruceIds = new Set(
    primaryEvent.changes.flatMap((change) =>
      change.type === "break-truce" ? [change.truceId] : [],
    ),
  );

  return beforeState.truces.flatMap((truce) => {
    if (explicitlyBrokenTruceIds.has(truce.id)) {
      return [];
    }

    const lostMember = truce.tributeIds.some((tributeId) => eliminatedTributeIds.has(tributeId));

    if (!lostMember) {
      return [];
    }

    const aftermathEventId = `truce-aftermath:` + `${primaryEvent.id}:` + truce.id;

    const response =
      truce.kind === "romantic"
        ? createRomanticDeathResponse(
            beforeState,
            afterPrimaryEventState,
            primaryEvent,
            truce,
            aftermathEventId,
          )
        : createStandardDeathResponse(
            beforeState,
            afterPrimaryEventState,
            primaryEvent,
            truce,
            aftermathEventId,
          );

    const dissolutionText = createAccidentalDissolutionText(
      beforeState,
      afterPrimaryEventState,
      truce,
      eliminatedTributeIds,
    );

    return [
      {
        id: aftermathEventId,

        definitionId:
          truce.kind === "romantic" ? "romantic-truce-ended-by-death" : "truce-ended-by-death",

        resolutionMode: "standard",

        round: {
          ...primaryEvent.round,
        },

        participantTributeIds: [
          ...new Set([...truce.tributeIds, ...response.participantTributeIds]),
        ],

        text: response.text ? `${dissolutionText} ${response.text}` : dissolutionText,

        changes: [
          ...response.changes,

          {
            type: "break-truce",
            truceId: truce.id,
            reason: "accidental",
          },
        ],
      },
    ];
  });
}
