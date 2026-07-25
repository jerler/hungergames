import { expect, test } from "@playwright/test";

test("loads a direct SPA route from the production build", async ({ page }) => {
  await page.goto("/create");

  /*
   * The opening may still be visible, or it may
   * complete before this assertion reaches it.
   */
  const skipButton = page.getByRole("button", {
    name: "Skip opening",
  });

  if (await skipButton.isVisible()) {
    await skipButton.click();
  }

  await expect(
    page.getByRole("heading", {
      level: 1,

      name: "Configure your arena",
    }),
  ).toBeVisible();

  await expect(page).toHaveURL(/\/create$/);
});
