import { expect, test } from "@playwright/test";

test("configures tributes and creates an initial Game", async ({ page }) => {
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
      name: "Choose your tributes",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: /Random Reaping/i,
    })
    .click();

  const portraitInput = page.locator('input[type="file"]').first();

  await portraitInput.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from("temporary portrait"),
  });

  await expect(
    page
      .getByRole("button", {
        name: "Remove",
      })
      .first(),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: /Start the Games/i,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "The arena is ready.",
    }),
  ).toBeVisible();

  await expect(
    page.getByText("12 tributes from 6 districts are prepared to enter the Games."),
  ).toBeVisible();
});
