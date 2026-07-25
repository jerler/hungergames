import {
  createPoisonAttackEvent,
  createRiskyAreaAttackEvent,
  createTrapAttackEvent,
} from "~/game/events/authoring";

import type { EventDefinition } from "~/game/events/event-schema";

export const TACTICAL_EVENTS = [
  createPoisonAttackEvent("blowgun-poison-attack", {
    poisonItemId: "blowgun",

    difficulty: 3,

    periods: ["day", "night"],

    weight: 1.6,

    successText: ({ killer, victim }) =>
      `${killer.name} strikes ${victim.name} with a poisoned blowgun dart. ` +
      `The poison will kill ${victim.pronouns.object} after one round ` +
      "unless an antidote or med kit is used.",

    failureText: ({ killer, victim }) =>
      `${killer.name} fires a poisoned blowgun dart at ${victim.name}, ` +
      `but it misses and ${victim.name} escapes.`,
  }),

  createPoisonAttackEvent("poison-vial-attack", {
    poisonItemId: "poison-vial",

    difficulty: 3,

    periods: ["day", "night"],

    weight: 1.25,

    successText: ({ killer, victim }) =>
      `${killer.name} tricks ${victim.name} into consuming poison from a vial. ` +
      `The poison will kill ${victim.pronouns.object} after one round ` +
      "unless an antidote or med kit is used.",

    failureText: ({ killer, victim }) =>
      `${killer.name} attempts to poison ${victim.name} with a vial, ` +
      `but ${victim.name} notices before swallowing it.`,
  }),

  createTrapAttackEvent("bear-trap-attack", {
    trapItemId: "bear-trap",

    causeLabel: "Killed in a bear trap",

    difficulty: 3,

    periods: ["day", "night"],

    weight: 1.4,

    criticalFailureStatus: {
      statusId: "injured",

      severity: 2,
    },

    criticalFailureText: ({ killer, victim }) =>
      `${killer.name} mishandles a bear trap while setting it for ${victim.name}. ` +
      `The jaws snap shut on ${killer.pronouns.possessiveAdjective} leg, ` +
      `injuring ${killer.pronouns.object} while ${victim.name} escapes.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} sets a bear trap along ${victim.name}'s path, ` +
      `but ${victim.name} notices the disturbed ground and steps around it.`,

    successText: ({ killer, victim }) =>
      `${killer.name} conceals a bear trap along ${victim.name}'s path. ` +
      `The trap catches ${victim.name}, allowing ${killer.name} to finish ` +
      `${victim.pronouns.object} before ${victim.pronouns.subject} can escape.`,

    exceptionalSuccessText: ({ killer, victim }) =>
      `${killer.name} disguises a bear trap perfectly. ` +
      `${victim.name} steps directly into it and is killed before ` +
      `${victim.pronouns.subject} can call for help.`,
  }),

  createTrapAttackEvent("tripwire-attack", {
    trapItemId: "tripwire",

    causeLabel: "Killed by a tripwire trap",

    difficulty: 3,

    periods: ["day", "night"],

    weight: 1.35,

    criticalFailureStatus: {
      statusId: "disoriented",

      severity: 2,
    },

    criticalFailureText: ({ killer, victim }) =>
      `${killer.name} becomes tangled while arranging a tripwire for ${victim.name}. ` +
      `By the time ${killer.pronouns.subject} gets free, ` +
      `${victim.name} is gone and ${killer.name} is badly disoriented.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} stretches a tripwire across ${victim.name}'s route, ` +
      `but ${victim.name} catches the line in the light and avoids it.`,

    successText: ({ killer, victim }) =>
      `${killer.name} rigs a tripwire across a dangerous stretch of terrain. ` +
      `${victim.name} catches ${victim.pronouns.possessiveAdjective} foot ` +
      `and falls to ${victim.pronouns.possessiveAdjective} death.`,

    exceptionalSuccessText: ({ killer, victim }) =>
      `${killer.name} channels ${victim.name} directly into a hidden tripwire. ` +
      `${victim.name} is thrown from the path and killed instantly.`,
  }),

  createRiskyAreaAttackEvent("firebomb-attack", {
    itemId: "firebomb",

    causeLabel: "Killed by a firebomb",

    difficulty: 3,

    periods: ["day", "night"],

    weight: 1.2,

    criticalFailureBurnSeverity: 2,

    criticalFailureText: ({ killer, victim }) =>
      `${killer.name}'s firebomb ignites before ${killer.pronouns.subject} can throw it. ` +
      `${killer.name} is badly burned, while ${victim.name} escapes the blast.`,

    failureText: ({ killer, victim }) =>
      `${killer.name} throws a firebomb at ${victim.name}, ` +
      `but it explodes harmlessly against the terrain as ${victim.name} dives away.`,

    successText: ({ killer, victim }) =>
      `${killer.name} hurls a firebomb into ${victim.name}'s position. ` +
      `The blast engulfs ${victim.name} and kills ${victim.pronouns.object}.`,

    exceptionalSuccessText: ({ killer, victim }) =>
      `${killer.name} places a firebomb perfectly and catches ${victim.name} ` +
      `at the centre of the explosion.`,
  }),
] satisfies readonly EventDefinition[];
