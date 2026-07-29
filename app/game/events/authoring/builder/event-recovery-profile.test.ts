// Phase 3 authored recovery-profile tests.
import { describe, expect, it } from "vitest";

import { createEvent } from "./create-event";
import { hasTreatmentFor } from "../requirements/item-requirements";
import { result } from "../outcomes/result";
import { always } from "../strategies/always";

describe("authored event recovery profiles", () => {
  it("compiles explicit survival-need targets", () => {
    const definition = createEvent("explicit-recovery-profile")
      .solo("actor")
      .category("survival")
      .tags("survival", "resource")
      .during("day")
      .weight(1)
      .addresses({
        kind: "survival-need",
        roleId: "actor",
        need: "water",
      })
      .resolve(
        always(
          result({
            text: "Water is found.",
          }),
        ),
      );

    expect(definition.recoveryProfile).toEqual({
      targets: [
        {
          kind: "survival-need",
          roleId: "actor",
          need: "water",
        },
      ],
    });
  });

  it("infers status recovery from treatment requirements", () => {
    const definition = createEvent("inferred-treatment-recovery")
      .solo("actor")
      .when(hasTreatmentFor("actor", "injured"))
      .category("survival")
      .tags("survival", "item", "status")
      .during("day")
      .weight(1)
      .resolve(
        always(
          result({
            text: "A wound is treated.",
          }),
        ),
      );

    expect(definition.recoveryProfile).toEqual({
      targets: [
        {
          kind: "status",
          roleId: "actor",
          statusIds: ["injured"],
        },
      ],
    });
  });

  it("rejects recovery targets for unknown roles", () => {
    expect(() =>
      createEvent("invalid-recovery-role")
        .solo("actor")
        .category("survival")
        .tags("survival")
        .during("day")
        .weight(1)
        .addresses({
          kind: "status",
          roleId: "missing",
          statusIds: ["injured"],
        })
        .resolve(
          always(
            result({
              text: "Invalid.",
            }),
          ),
        ),
    ).toThrow(/unknown role/i);
  });

  it("rejects beneficial statuses as recovery priorities", () => {
    expect(() =>
      createEvent("invalid-beneficial-recovery")
        .solo("actor")
        .category("survival")
        .tags("survival")
        .during("day")
        .weight(1)
        .addresses({
          kind: "status",
          roleId: "actor",
          statusIds: ["hidden"],
        })
        .resolve(
          always(
            result({
              text: "Invalid.",
            }),
          ),
        ),
    ).toThrow(/beneficial status/i);
  });
});
