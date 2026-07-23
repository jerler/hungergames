import type { EventStat, StatCheckDifficulty } from "~/game/events/event-outcomes";

export interface AuthoredStatCheck {
  stat: EventStat;
  difficulty: StatCheckDifficulty;
  luckAdjusted: boolean;
}
