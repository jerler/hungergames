import type { EventCategory, EventDefinition, EventTag } from "~/game/events/event-schema";
import type { AuthoredRequirement } from "~/game/events/authoring/requirements/requirement-schema";
import { groupRole, soloRole } from "~/game/events/authoring/roles/role-presets";
import type {
  AuthoredRoleOptions,
  AuthoredRoleSpecification,
} from "~/game/events/authoring/roles/role-schema";

import { compileEvent } from "./compile-event";
import type {
  AuthoredEventConfiguration,
  EventResolutionStrategy,
  EventWeightMultiplier,
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

  public weightMultiplier(getWeightMultiplier: EventWeightMultiplier): EventBuilder {
    return this.with({
      getWeightMultiplier,
    });
  }

  /**
   * Adds one or more authored participant roles.
   *
   * Repeated calls append roles while preserving their
   * authored order.
   */
  public roles(...roles: readonly AuthoredRoleSpecification[]): EventBuilder {
    return this.with({
      roles: [...this.configuration.roles, ...roles],
    });
  }

  /**
   * Convenience method for a two-role event.
   *
   * The supplied role order is preserved.
   */
  public pair(
    firstRole: AuthoredRoleSpecification,
    secondRole: AuthoredRoleSpecification,
  ): EventBuilder {
    return this.roles(firstRole, secondRole);
  }

  /**
   * Convenience method for a repeated same-role group.
   */
  public group(roleId: string, count: number, options: AuthoredRoleOptions = {}): EventBuilder {
    return this.roles(groupRole(roleId, count, options));
  }

  /**
   * Convenience method for a neutral single-participant role.
   */
  public solo(roleId = "tribute", options: AuthoredRoleOptions = {}): EventBuilder {
    return this.roles(soloRole(roleId, options));
  }

  /**
   * Adds declarative participant or relationship
   * requirements to the event.
   */
  public when(...requirements: readonly AuthoredRequirement[]): EventBuilder {
    return this.with({
      requirements: [...this.configuration.requirements, ...requirements],
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
