import type { EliminateEffect } from "./effect-schema";

export interface EliminateOptions {
  causeId: string;
  causeLabel: string;
}

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
