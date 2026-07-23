import type { EliminateEffect } from "./effect-schema";

export interface EliminateOptions {
  causeId: string;
  causeLabel: string;
}

export type KillOptions = EliminateOptions;

export function eliminate(
  roleId: string,
  { causeId, causeLabel }: EliminateOptions,
): EliminateEffect {
  return {
    type: "eliminate",
    roleId,
    causeId,
    causeLabel,
  };
}

export function kill(
  killerRoleId: string,
  victimRoleId: string,
  { causeId, causeLabel }: KillOptions,
): EliminateEffect {
  return {
    type: "eliminate",
    roleId: victimRoleId,
    killerRoleId,
    causeId,
    causeLabel,
  };
}
