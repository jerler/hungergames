import type { TributeDefinition, TributeStatValue } from "~/game/types/tribute";

function createTributeDefinition(
  id: string,
  name: string,
  brains: TributeStatValue,
  brawn: TributeStatValue,
  luck: TributeStatValue,
): TributeDefinition {
  return {
    id,
    name,
    portraitUrl: null,
    stats: {
      brains,
      brawn,
      luck,
    },
  };
}

export const DEFAULT_TRIBUTES = [
  createTributeDefinition("avery-chen", "Avery Chen", 4, 2, 3),
  createTributeDefinition("blair-okafor", "Blair Okafor", 3, 4, 2),
  createTributeDefinition("cameron-singh", "Cameron Singh", 5, 2, 2),
  createTributeDefinition("casey-laurent", "Casey Laurent", 2, 3, 5),
  createTributeDefinition("dakota-reyes", "Dakota Reyes", 3, 5, 2),
  createTributeDefinition("devon-park", "Devon Park", 4, 3, 3),
  createTributeDefinition("drew-bennett", "Drew Bennett", 2, 4, 4),
  createTributeDefinition("eden-brooks", "Eden Brooks", 5, 1, 4),
  createTributeDefinition("ellis-morgan", "Ellis Morgan", 3, 3, 3),
  createTributeDefinition("emery-clarke", "Emery Clarke", 4, 4, 1),
  createTributeDefinition("finley-shah", "Finley Shah", 5, 2, 3),
  createTributeDefinition("frankie-bell", "Frankie Bell", 2, 5, 3),
  createTributeDefinition("harper-nguyen", "Harper Nguyen", 4, 2, 4),
  createTributeDefinition("hayden-price", "Hayden Price", 1, 5, 4),
  createTributeDefinition("jamie-torres", "Jamie Torres", 3, 4, 3),
  createTributeDefinition("jordan-kim", "Jordan Kim", 5, 3, 2),
  createTributeDefinition("jules-martin", "Jules Martin", 4, 1, 5),
  createTributeDefinition("kai-patel", "Kai Patel", 3, 5, 2),
  createTributeDefinition("kendall-ross", "Kendall Ross", 2, 3, 5),
  createTributeDefinition("logan-foster", "Logan Foster", 3, 4, 4),
  createTributeDefinition("marley-scott", "Marley Scott", 5, 2, 3),
  createTributeDefinition("morgan-hayes", "Morgan Hayes", 4, 4, 2),
  createTributeDefinition("nico-santos", "Nico Santos", 2, 5, 4),
  createTributeDefinition("parker-james", "Parker James", 3, 3, 5),
  createTributeDefinition("quinn-walker", "Quinn Walker", 5, 1, 3),
  createTributeDefinition("reese-taylor", "Reese Taylor", 4, 3, 2),
  createTributeDefinition("riley-adams", "Riley Adams", 2, 4, 5),
  createTributeDefinition("rowan-ellis", "Rowan Ellis", 4, 2, 5),
  createTributeDefinition("sam-rivera", "Sam Rivera", 3, 5, 3),
  createTributeDefinition("sydney-cole", "Sydney Cole", 5, 3, 1),
] satisfies readonly TributeDefinition[];
