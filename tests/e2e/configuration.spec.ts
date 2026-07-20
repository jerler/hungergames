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
      name: "Prepare the tributes",
    }),
  ).toBeVisible();

  const firstNameInput = page.getByLabel("Tribute name").first();

  await firstNameInput.fill("Test Tribute");

  const firstPortraitInput = page.getByLabel(/Upload portrait for/i).first();

  await firstPortraitInput.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  await expect(
    page
      .getByRole("button", {
        name: "Remove portrait",
      })
      .first(),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: /Randomize blanks/i,
    })
    .click();

  await expect(firstNameInput).toHaveValue("Test Tribute");

  await expect(
    page
      .getByRole("button", {
        name: "Remove portrait",
      })
      .first(),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: /Start the Games/i,
    })
    .first()
    .click();

  await expect(
    page.getByRole("heading", {
      name: "The arena is ready.",
    }),
  ).toBeVisible();

  await expect(
    page.getByText("12 tributes from 6 districts are waiting for the signal."),
  ).toBeVisible();
});
