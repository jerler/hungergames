import { expect, test } from "@playwright/test";

test("loads the Phase 0 application shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Hunger Games Simulator",
    }),
  ).toBeVisible();
});
