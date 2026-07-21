import { getVulnerabilityWeight } from "~/game/engine/stat-formulas";
import { createFatalChanges } from "~/game/events/event-change-builders";
import {
  requireSingleParticipant,
  type EventDefinition,
  type EventResolution,
} from "~/game/events/event-schema";
import { createCombatantRole } from "~/game/events/participant-role-builders";

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

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const spear = killer.inventory.find(
        (item) => item.definitionId === "spear" && item.usesRemaining > 0,
      );

      if (!spear) {
        throw new Error("Spear attack selected a killer without a spear.");
      }

      const text =
        `${killer.snapshot.name} strikes ` + `${victim.snapshot.name} down with a spear.`;

      return {
        text,

        changes: [
          ...createFatalChanges(victim, "spear-attack", "Speared", text, killer),
          {
            type: "consume-item",
            tributeId: killer.id,
            itemInstanceId: spear.id,
            uses: 1,
            reason: "spear-attack",
          },
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

    resolve({ participantsByRole }): EventResolution {
      const victim = requireSingleParticipant(participantsByRole, "victim");

      const killer = requireSingleParticipant(participantsByRole, "killer");

      const knife = killer.inventory.find(
        (item) => item.definitionId === "knife" && item.usesRemaining > 0,
      );

      if (!knife) {
        throw new Error("Knife ambush selected a killer without a knife.");
      }

      const text =
        `${killer.snapshot.name} catches ` +
        `${victim.snapshot.name} by surprise ` +
        "and kills them with a knife.";

      return {
        text,

        changes: [
          ...createFatalChanges(victim, "knife-ambush", "Knifed", text, killer),
          {
            type: "consume-item",
            tributeId: killer.id,
            itemInstanceId: knife.id,
            uses: 1,
            reason: "knife-ambush",
          },
        ],
      };
    },
  },
] satisfies readonly EventDefinition[];
