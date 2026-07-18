import { expect, test } from "@playwright/test";

test("configures a Game and continues to the Reaping", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("link", {
      name: /Create the Games/i,
    })
    .click();

  await page
    .getByRole("button", {
      name: "Skip opening",
    })
    .click();

  await page
    .getByRole("radio", {
      name: /Half Games/i,
    })
    .check();

  await page
    .getByRole("checkbox", {
      name: "Enable audience participation",
    })
    .check();

  await page.getByLabel("Voting time limit").fill("90");

  await page
    .getByRole("button", {
      name: /Continue to the Reaping/i,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "The Reaping",
    }),
  ).toBeVisible();
});
