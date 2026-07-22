import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import { createFatalChanges, createItemUseChange } from "~/game/events/event-change-builders";
import { requireEventItem } from "~/game/events/event-resolution-helpers";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { createCombatantRole } from "~/game/events/participant-role-builders";
import { getTributePronouns } from "~/game/tributes/pronouns";

const victimRole = {
  id: "victim",
  count: 1,
  getWeight: getVulnerabilityWeight,
} as const;

export const COMBAT_EVENTS = [
  /* Day Only */
  {
    id: "spear-attack",
    category: "fatal",
    tags: ["fatal", "combat", "weapon"],
    periods: ["day"],
    baseWeight: 2.25,

    roles: [
      victimRole,
      createCombatantRole({
        requiredItemDefinitionIds: ["spear"],
      }),
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    resolve(context): EventResolution {
      const { participantsByRole } = context;

      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const spear = requireEventItem(context, killer, "spear", "spear-attack");

      const text =
        `${killer.snapshot.name} strikes ` + `${victim.snapshot.name} down with a spear.`;

      return {
        text,

        changes: [
          ...createFatalChanges(victim, "spear-attack", "Speared", text, killer),

          createItemUseChange(spear.owner, spear.item, "spear-attack"),
        ],
      };
    },
  },

  /* Night Only */

  /* Day and Night */
  {
    id: "knife-ambush",
    category: "fatal",
    tags: ["fatal", "combat", "weapon"],
    periods: ["day", "night"],
    baseWeight: 2.5,

    roles: [
      victimRole,
      createCombatantRole({
        requiredItemDefinitionIds: ["knife"],
      }),
    ],

    isEligible: ({ livingTributes }) => livingTributes.length >= 2,

    resolve(context): EventResolution {
      const { participantsByRole } = context;

      const victim = requireSingleParticipant(participantsByRole, "victim");
      const victimPronouns = getTributePronouns(victim);

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const knife = requireEventItem(context, killer, "knife", "knife-ambush");

      const text =
        `${killer.snapshot.name} catches ` +
        `${victim.snapshot.name} by surprise ` +
        `and kills ${victimPronouns.object} with a knife.`;

      return {
        text,

        changes: [
          ...createFatalChanges(victim, "knife-ambush", "Knifed", text, killer),

          createItemUseChange(knife.owner, knife.item, "knife-ambush"),
        ],
      };
    },
  },
] satisfies readonly EventDefinition[];
