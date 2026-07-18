import { expect, test } from "@playwright/test";

test("loads the landing page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Let the Games begin/i,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", {
      name: /Create the Games/i,
    }),
  ).toBeVisible();
});
