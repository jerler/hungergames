import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StarRating } from "./star-rating";

describe("StarRating", () => {
  it("reports the selected star value", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<StarRating id="tribute-brains" label="Brains" value={3} onChange={handleChange} />);

    await user.click(
      screen.getByRole("radio", {
        name: "5 out of 5 stars",
      }),
    );

    expect(handleChange).toHaveBeenCalledWith(5);
  });

  it("exposes the current value as checked", () => {
    render(<StarRating id="tribute-luck" label="Luck" value={4} onChange={vi.fn()} />);

    expect(
      screen.getByRole("radio", {
        name: "4 out of 5 stars",
      }),
    ).toBeChecked();
  });
});
