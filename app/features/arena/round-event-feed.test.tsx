import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  EliminateTributeChange,
  ResolvedEvent,
  ResolvedEventKind,
} from "~/game/types/game-state";

import { RoundEventFeed } from "./round-event-feed";

const TEST_ROUND = {
  day: 1,
  period: "day",
} as const;

function createEvent(
  eliminatedTributeIds: readonly string[],
  kind: ResolvedEventKind = "primary",
): ResolvedEvent {
  const changes = eliminatedTributeIds.map((tributeId): EliminateTributeChange => ({
    type: "eliminate-tribute",

    tributeId,

    causeId: "test-elimination",

    causeLabel: "Test elimination",

    summary: `${tributeId} was eliminated.`,

    killerTributeIds: [],
  }));

  return {
    id: "test-event",

    definitionId: "test-event",
    kind,
    resolutionMode: "standard",

    round: TEST_ROUND,

    participantTributeIds: [...eliminatedTributeIds],

    text: "Several cannons echo across the arena.",

    changes,
  };
}

describe("RoundEventFeed", () => {
  it.each([1, 2, 3])("renders one cannon pill for each of %s eliminations", (eliminationCount) => {
    const event = createEvent(
      Array.from(
        {
          length: eliminationCount,
        },

        (_, index) => `tribute-${index + 1}`,
      ),
    );

    render(<RoundEventFeed events={[event]} round={TEST_ROUND} totalEventCount={1} />);

    expect(screen.getAllByText("Cannon fired")).toHaveLength(eliminationCount);

    expect(
      screen.getByRole(
        "group",

        {
          name: eliminationCount === 1 ? "1 cannon fired" : `${eliminationCount} cannons fired`,
        },
      ),
    ).toBeInTheDocument();
  });

  it("does not render cannon pills for a nonfatal event", () => {
    const event = createEvent([]);

    render(<RoundEventFeed events={[event]} round={TEST_ROUND} totalEventCount={1} />);

    expect(screen.queryByText("Cannon fired")).not.toBeInTheDocument();
  });

  it.each(["primary", "aftermath", "status-resolution"] as const)(
    "renders %s events without filtering them",
    (kind) => {
      const event = createEvent([], kind);

      const { container } = render(
        <RoundEventFeed events={[event]} round={TEST_ROUND} totalEventCount={1} />,
      );

      expect(screen.getByText("Several cannons echo across the arena.")).toBeInTheDocument();
      expect(container.querySelector(`[data-event-kind="${kind}"]`)).toBeInTheDocument();
    },
  );
});
