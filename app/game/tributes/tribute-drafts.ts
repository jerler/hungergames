import { DEFAULT_TRIBUTES } from "~/game/tributes/default-tributes";
import { DEFAULT_PRONOUN_SET_ID } from "./pronouns";
import type { DistrictCount } from "~/game/types/game-config";
import type { TributeDefinition, TributeDraft } from "~/game/types/tribute";

export type TributeAssignmentMode = "random" | "manual";

type RandomSource = () => number;

interface TributeSlot {
  id: string;
  district: number;
  districtPosition: 1 | 2;
}

function createTributeSlots(districtCount: DistrictCount): TributeSlot[] {
  const slots: TributeSlot[] = [];

  for (let district = 1; district <= districtCount; district += 1) {
    slots.push({
      id: `district-${district}-tribute-1`,
      district,
      districtPosition: 1,
    });

    slots.push({
      id: `district-${district}-tribute-2`,
      district,
      districtPosition: 2,
    });
  }

  return slots;
}

function shuffleItems<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffledItems = [...items];

  for (let currentIndex = shuffledItems.length - 1; currentIndex > 0; currentIndex -= 1) {
    const randomIndex = Math.floor(random() * (currentIndex + 1));

    const currentItem = shuffledItems[currentIndex];
    const randomItem = shuffledItems[randomIndex];

    shuffledItems[currentIndex] = randomItem;
    shuffledItems[randomIndex] = currentItem;
  }

  return shuffledItems;
}

function createBlankDraft(slot: TributeSlot): TributeDraft {
  return {
    ...slot,
    sourceDefinitionId: null,
    name: "",
    pronouns: DEFAULT_PRONOUN_SET_ID,
    portraitPreviewUrl: null,
    portraitPosition: {
      x: 50,
      y: 50,
    },
    stats: {
      brains: 3,
      brawn: 3,
      luck: 3,
    },
  };
}

function createDraftFromDefinition(slot: TributeSlot, definition: TributeDefinition): TributeDraft {
  return {
    ...slot,
    sourceDefinitionId: definition.id,
    name: definition.name,
    pronouns: definition.pronouns ?? DEFAULT_PRONOUN_SET_ID,
    portraitPreviewUrl: definition.portraitUrl,
    stats: {
      ...definition.stats,
    },
  };
}

export function createBlankTributeDrafts(districtCount: DistrictCount): TributeDraft[] {
  return createTributeSlots(districtCount).map(createBlankDraft);
}

export function haveTributeDraftsBeenEdited(
  tributeDrafts: readonly TributeDraft[],
): boolean {
  return tributeDrafts.some(
    (tribute) =>
      tribute.sourceDefinitionId !== null ||
      tribute.name !== "" ||
      tribute.pronouns !==
        DEFAULT_PRONOUN_SET_ID ||
      tribute.portraitPreviewUrl !== null ||
      tribute.stats.brains !== 3 ||
      tribute.stats.brawn !== 3 ||
      tribute.stats.luck !== 3,
  );
}

export function createRandomTributeDrafts(
  districtCount: DistrictCount,
  definitions: readonly TributeDefinition[] = DEFAULT_TRIBUTES,
  random: RandomSource = Math.random,
): TributeDraft[] {
  const slots = createTributeSlots(districtCount);

  if (definitions.length < slots.length) {
    throw new Error(`Random assignment requires at least ${slots.length} tribute definitions.`);
  }

  const selectedDefinitions = shuffleItems(definitions, random).slice(0, slots.length);

  return slots.map((slot, index) => createDraftFromDefinition(slot, selectedDefinitions[index]));
}

export function randomizeTributeDraft(
  tributeDrafts: readonly TributeDraft[],
  tributeId: string,
  definitions: readonly TributeDefinition[] = DEFAULT_TRIBUTES,
  random: RandomSource = Math.random,
): TributeDraft[] {
  const tributeToReplace = tributeDrafts.find((tribute) => tribute.id === tributeId);

  if (!tributeToReplace) {
    return [...tributeDrafts];
  }

  const usedDefinitionIds = new Set(
    tributeDrafts
      .filter((tribute) => tribute.id !== tributeId)
      .map((tribute) => tribute.sourceDefinitionId)
      .filter((definitionId): definitionId is string => definitionId !== null),
  );

  const availableDefinitions = definitions.filter(
    (definition) => !usedDefinitionIds.has(definition.id),
  );

  if (availableDefinitions.length === 0) {
    return [...tributeDrafts];
  }

  const selectedDefinition =
    availableDefinitions[Math.floor(random() * availableDefinitions.length)];

  return tributeDrafts.map((tribute) => {
    if (tribute.id !== tributeId) {
      return tribute;
    }

    return createDraftFromDefinition(
      {
        id: tribute.id,
        district: tribute.district,
        districtPosition: tribute.districtPosition,
      },
      selectedDefinition,
    );
  });
}
