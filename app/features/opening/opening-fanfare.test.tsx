import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpeningFanfare } from "./opening-fanfare";

describe("OpeningFanfare", () => {
  it("allows the host to skip the opening", () => {
    const handleComplete = vi.fn();

    render(<OpeningFanfare onComplete={handleComplete} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Skip opening",
      }),
    );

    expect(handleComplete).toHaveBeenCalledOnce();
  });
});
