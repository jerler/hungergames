import { formatRoundLabel } from "~/game/engine/rounds";

import type { TributeSurvivalState } from "./survival-schema";

type RecordedNightRest = NonNullable<TributeSurvivalState["lastNightRest"]>;

export type RestPresentationTone = "comfortable" | "sheltered" | "unsheltered";

export interface RestPresentationDetails {
  label: string;
  roundLabel: string;
  summary: string;
  tone: RestPresentationTone;
}

export function createRestPresentation(rest: RecordedNightRest): RestPresentationDetails {
  const roundLabel = formatRoundLabel(rest.round);

  switch (rest.quality) {
    case "comfortable":
      return {
        label: "Comfortable rest",

        roundLabel,

        summary: `Rested comfortably during ${roundLabel}.`,

        tone: "comfortable",
      };

    case "sheltered":
      return {
        label: "Sheltered rest",

        roundLabel,

        summary: `Rested under shelter during ${roundLabel}.`,

        tone: "sheltered",
      };

    case "unsheltered":
      return {
        label: "Unsheltered night",

        roundLabel,

        summary: `Spent ${roundLabel} without adequate shelter.`,

        tone: "unsheltered",
      };
  }
}
