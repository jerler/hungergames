import type { EventCategory, EventDefinition, EventTag } from "~/game/events/event-schema";

import { compileEvent } from "./compile-event";
import type {
  AuthoredEventConfiguration,
  EventResolutionStrategy,
  SoloRoleOptions,
} from "./event-builder-types";

export class EventBuilder {
  public constructor(private readonly configuration: AuthoredEventConfiguration) {}

  public category(category: EventCategory): EventBuilder {
    return this.with({
      category,
    });
  }

  public tags(...tags: readonly EventTag[]): EventBuilder {
    return this.with({
      tags: [...tags],
    });
  }

  public during(...periods: readonly ("day" | "night")[]): EventBuilder {
    return this.with({
      periods: [...periods],
    });
  }

  public weight(baseWeight: number): EventBuilder {
    return this.with({
      baseWeight,
    });
  }

  public solo(roleId = "tribute", options: SoloRoleOptions = {}): EventBuilder {
    return this.with({
      roles: [
        ...this.configuration.roles,

        {
          id: roleId,
          count: 1,
          ...options,
        },
      ],
    });
  }

  public resolve(strategy: EventResolutionStrategy): EventDefinition {
    return compileEvent(this.configuration, strategy);
  }

  private with(changes: Partial<AuthoredEventConfiguration>): EventBuilder {
    return new EventBuilder({
      ...this.configuration,
      ...changes,
    });
  }
}
