import type { GameTribute } from "~/game/types/game-state";
import type { TributeStats } from "~/game/types/tribute";
import { getTributePronouns, type PronounGrammar } from "~/game/tributes/pronouns";

export interface EventPronouns extends PronounGrammar {
  /**
   * Selects the grammatically correct verb form.
   *
   * Example:
   *
   * pronouns.verb("wash", "washes")
   *
   * they wash
   * she washes
   * he washes
   * it washes
   */
  verb: (pluralForm: string, singularForm: string) => string;
}

export interface EventCharacter {
  id: string;
  name: string;

  stats: Readonly<TributeStats>;
  pronouns: EventPronouns;

  /**
   * The original tribute remains available for mechanics
   * that require inventory, statuses, statistics, or other
   * engine-level information.
   */
  tribute: GameTribute;
}

export function createEventCharacter(tribute: GameTribute): EventCharacter {
  const grammar = getTributePronouns(tribute);

  return {
    id: tribute.id,
    name: tribute.snapshot.name,

    stats: tribute.snapshot.stats,

    pronouns: {
      ...grammar,

      verb: (pluralForm, singularForm) => (grammar.bePresent === "are" ? pluralForm : singularForm),
    },

    tribute,
  };
}
