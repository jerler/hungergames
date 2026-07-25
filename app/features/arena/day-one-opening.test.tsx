import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DayOneOpening } from "./day-one-opening";

describe("DayOneOpening", () => {
  it("introduces the Bloodbath and fires the starting cannon", () => {
    const handleFireCannon = vi.fn();

    render(<DayOneOpening tributeCount={12} onFireCannon={handleFireCannon} />);

    expect(
      screen.getByRole("heading", {
        name: "The tributes enter the arena.",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/The 12 tributes stand on their launch plates/i)).toBeInTheDocument();

    expect(handleFireCannon).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Fire the cannon",
      }),
    );

    expect(handleFireCannon).toHaveBeenCalledOnce();
  });
});
