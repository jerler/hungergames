export type RandomSource = () => number;

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: string): RandomSource {
  let state = hashSeed(seed);

  return () => {
    state += 0x6d2b79f5;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);

    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleItems<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffledItems = [...items];

  for (let currentIndex = shuffledItems.length - 1; currentIndex > 0; currentIndex -= 1) {
    const randomIndex = Math.floor(random() * (currentIndex + 1));

    const currentItem = shuffledItems[currentIndex];

    shuffledItems[currentIndex] = shuffledItems[randomIndex];

    shuffledItems[randomIndex] = currentItem;
  }

  return shuffledItems;
}

export function selectRandomItem<T>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) {
    throw new Error("Cannot select a random item from an empty collection.");
  }

  return items[Math.floor(random() * items.length)];
}

export function selectWeightedItem<T>(
  items: readonly T[],
  getWeight: (item: T) => number,
  random: RandomSource,
): T {
  if (items.length === 0) {
    throw new Error("Cannot select a weighted item from an empty collection.");
  }

  const weightedItems = items.map((item) => ({
    item,
    weight: Math.max(0, getWeight(item)),
  }));

  const totalWeight = weightedItems.reduce((total, entry) => total + entry.weight, 0);

  if (totalWeight <= 0) {
    return selectRandomItem(items, random);
  }

  let threshold = random() * totalWeight;

  for (const entry of weightedItems) {
    threshold -= entry.weight;

    if (threshold <= 0) {
      return entry.item;
    }
  }

  return weightedItems[weightedItems.length - 1].item;
}
