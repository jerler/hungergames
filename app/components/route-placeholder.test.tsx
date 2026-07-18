import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { RoutePlaceholder } from "./route-placeholder";

describe("RoutePlaceholder", () => {
  it("renders the route title and description", () => {
    render(
      <MemoryRouter>
        <RoutePlaceholder title="Create the Games" description="Configure a new simulation." />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Create the Games",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Configure a new simulation.")).toBeInTheDocument();
  });
});
