import { createItemUseChange, createSurvivalChanges } from "~/game/events/event-change-builders";
import { requireSingleParticipant, type EventDefinition } from "~/game/events/event-schema";
import { getTributePronouns } from "~/game/tributes/pronouns";

import { isLowBrains, requireSelectedItem, statSelectionProfile } from "../stat-gated-helpers";

const CHILDPROOFED_MEDKIT_BRAINS: EventDefinition = {
  id: "low-brains-childproofed-medkit",
  category: "hazard",
  periods: ["day", "night"],
  baseWeight: 10,
  tags: ["hazard", "item"],
  selectionProfile: statSelectionProfile(4, ["item-requirement"]),
  roles: [
    {
      id: "actor",
      count: 1,
      isEligible: isLowBrains,
      requiredItemDefinitionIds: ["med-kit"],
      itemAccess: "owned",
    },
  ],
  resolve(context) {
    const actor = requireSingleParticipant(context.participantsByRole, "actor");
    const pronouns = getTributePronouns(actor);
    const medKit = requireSelectedItem(context, "actor");

    return {
      text:
        `After slicing ${pronouns.possessiveAdjective} arm deeply on a rogue branch, ` +
        `${actor.snapshot.name} spends ten humiliating minutes trying to figure out how to open ` +
        `the child-proof latch on the medkit's packaging before finally reaching the supplies inside.`,
      changes: [
        createItemUseChange(actor, medKit, context.eventId),
        ...createSurvivalChanges([actor]),
      ],
    };
  },
};

export const LOW_BRAINS_EVENTS = [CHILDPROOFED_MEDKIT_BRAINS] satisfies readonly EventDefinition[];
