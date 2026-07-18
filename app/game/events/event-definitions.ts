import type { GameTribute, RoundReference } from "~/game/types/game-state";

export interface FatalEventDefinition {
  id: string;
  causeLabel: string;
  periods: Array<RoundReference["period"]>;
  requiresKiller: boolean;

  createText: (victim: GameTribute, killer: GameTribute | null) => string;
}

export interface SurvivalEventDefinition {
  id: string;
  periods: Array<RoundReference["period"]>;
  participantCount: 1 | 2;

  createText: (participants: readonly GameTribute[]) => string;
}

export const FATAL_EVENT_DEFINITIONS = [
  {
    id: "knife-ambush",
    causeLabel: "Knifed",
    periods: ["day", "night"],
    requiresKiller: true,

    createText(victim, killer) {
      return `${killer?.snapshot.name} catches ${victim.snapshot.name} by surprise and kills them with a knife.`;
    },
  },
  {
    id: "spear-attack",
    causeLabel: "Speared",
    periods: ["day"],
    requiresKiller: true,

    createText(victim, killer) {
      return `${killer?.snapshot.name} strikes ${victim.snapshot.name} down with a spear.`;
    },
  },
  {
    id: "fallen-cliff",
    causeLabel: "Fell",
    periods: ["day", "night"],
    requiresKiller: false,

    createText(victim) {
      return `${victim.snapshot.name} loses their footing near a cliff and falls to their death.`;
    },
  },
  {
    id: "poisonous-berries",
    causeLabel: "Poisoned",
    periods: ["day"],
    requiresKiller: false,

    createText(victim) {
      return `${victim.snapshot.name} mistakes poisonous berries for food.`;
    },
  },
  {
    id: "freezing-night",
    causeLabel: "Froze",
    periods: ["night"],
    requiresKiller: false,

    createText(victim) {
      return `${victim.snapshot.name} is unable to find shelter and freezes during the night.`;
    },
  },
  {
    id: "river-current",
    causeLabel: "Drowned",
    periods: ["day"],
    requiresKiller: false,

    createText(victim) {
      return `${victim.snapshot.name} is swept away while attempting to cross a violent river.`;
    },
  },
] satisfies readonly FatalEventDefinition[];

export const SURVIVAL_EVENT_DEFINITIONS = [
  {
    id: "finds-water",
    periods: ["day"],
    participantCount: 1,

    createText([tribute]) {
      return `${tribute.snapshot.name} discovers a source of clean water.`;
    },
  },
  {
    id: "finds-hiding-place",
    periods: ["day", "night"],
    participantCount: 1,

    createText([tribute]) {
      return `${tribute.snapshot.name} finds a concealed place to rest.`;
    },
  },
  {
    id: "keeps-watch",
    periods: ["night"],
    participantCount: 1,

    createText([tribute]) {
      return `${tribute.snapshot.name} stays awake through the night, listening for danger.`;
    },
  },
  {
    id: "searches-for-supplies",
    periods: ["day"],
    participantCount: 1,

    createText([tribute]) {
      return `${tribute.snapshot.name} spends the day searching the arena for supplies.`;
    },
  },
  {
    id: "temporary-truce",
    periods: ["day", "night"],
    participantCount: 2,

    createText([firstTribute, secondTribute]) {
      return `${firstTribute.snapshot.name} and ${secondTribute.snapshot.name} agree to a temporary truce.`;
    },
  },
] satisfies readonly SurvivalEventDefinition[];
