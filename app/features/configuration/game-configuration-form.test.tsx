import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GIFT_DEFINITIONS } from "~/game/gifts/gift-definitions";

import { GameConfigurationForm } from "./game-configuration-form";

describe("GameConfigurationForm", () => {
  it("submits a valid configured Game", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<GameConfigurationForm onSubmit={handleSubmit} />);

    await user.click(
      screen.getByRole("radio", {
        name: /Half Games/i,
      }),
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /Audience participation/i,
      }),
    );

    const durationInput = screen.getByLabelText("Voting time limit");

    await user.clear(durationInput);
    await user.type(durationInput, "90");

    await user.click(
      screen.getByRole("button", {
        name: /Continue to the Reaping/i,
      }),
    );

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        districtCount: 6,
        giftsEnabled: true,
        audienceEnabled: true,
        giftVoteDurationSeconds: 90,
      }),
    );
  });

  it("turns off audience participation when gifts are disabled", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<GameConfigurationForm onSubmit={handleSubmit} />);

    const audienceToggle = screen.getByRole("checkbox", {
      name: "Enable audience participation",
    });

    await user.click(audienceToggle);

    expect(audienceToggle).toBeChecked();

    const giftsToggle = screen.getByRole("checkbox", {
      name: "Enable tribute gifts",
    });

    await user.click(giftsToggle);

    expect(giftsToggle).not.toBeChecked();

    await waitFor(() => {
      expect(
        screen.queryByRole("checkbox", {
          name: "Enable audience participation",
        }),
      ).not.toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /Continue to the Reaping/i,
      }),
    );

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        giftsEnabled: false,
        audienceEnabled: false,
      }),
    );
  });

  it("requires at least one enabled gift", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<GameConfigurationForm onSubmit={handleSubmit} />);

    for (const gift of GIFT_DEFINITIONS) {
      await user.selectOptions(screen.getByLabelText(`Frequency for ${gift.name}`), "disabled");
    }

    await user.click(
      screen.getByRole("button", {
        name: /Continue to the Reaping/i,
      }),
    );

    expect(screen.getByText("Enable at least one gift before continuing.")).toBeInTheDocument();

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
