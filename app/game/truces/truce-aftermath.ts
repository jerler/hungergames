import type { GameState, ResolvedEvent, Truce } from "~/game/types/game-state";
import { createStatusEffectInstance } from "~/game/statuses/status-engine";
import type { GameChange } from "~/game/types/game-state";

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

  const survivingMemberNames = truce.tributeIds.flatMap((tributeId) => {
    const tribute = afterState.tributes.find(
      (candidate) => candidate.id === tributeId && candidate.isAlive,
    );

    return tribute ? [tribute.snapshot.name] : [];
  });

  const eliminatedNames = formatNameList(eliminatedMemberNames);

  if (survivingMemberNames.length === 0) {
    return `The deaths of ${eliminatedNames} ` + "bring their truce to an abrupt end.";
  }

  if (survivingMemberNames.length === 1) {
    return (
      `With ${eliminatedNames} dead, ` +
      `${survivingMemberNames[0]} is left on their own. ` +
      "Their truce ends abruptly."
    );
  }

  return (
    `The death of ${eliminatedNames} brings the truce ` +
    `to an abrupt end. ${formatNameList(survivingMemberNames)} go their separate ways.`
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

  const survivingNames = truce.tributeIds.flatMap((tributeId) => {
    const tribute = afterState.tributes.find(
      (candidate) => candidate.id === tributeId && candidate.isAlive,
    );

    return tribute ? [tribute.snapshot.name] : [];
  });

  if (survivingNames.length === 0) {
    return (
      `${formatNameList(eliminatedNames)} die together. ` + "Their promise ends only when they do."
    );
  }

  return (
    `With ${formatNameList(eliminatedNames)} dead, ` +
    `${survivingNames[0]} is devastated. ` +
    "Their romantic truce ends only because the arena has torn them apart."
  );
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

  /*
   * A primary event may eventually
   * handle its own truce breakup.
   * Avoid generating a duplicate
   * automatic aftermath in that case.
   */
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

    const survivingMember =
      truce.kind === "romantic"
        ? truce.tributeIds
            .map((tributeId) =>
              afterPrimaryEventState.tributes.find(
                (tribute) => tribute.id === tributeId && tribute.isAlive,
              ),
            )
            .find((tribute): tribute is NonNullable<typeof tribute> => Boolean(tribute))
        : undefined;

    const emotionalChanges: GameChange[] = survivingMember
      ? [
          {
            type: "apply-status",

            tributeId: survivingMember.id,

            status: createStatusEffectInstance(
              aftermathEventId,
              survivingMember.id,
              "disoriented",
              2,
              primaryEvent.round,
            ),
          },
        ]
      : [];

    const text = createAccidentalDissolutionText(
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

        participantTributeIds: [...truce.tributeIds],

        text,

        changes: [
          ...emotionalChanges,

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
