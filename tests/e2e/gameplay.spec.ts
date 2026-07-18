import { expect, test } from "@playwright/test";

test("runs a local Game until one victor remains", async ({ page }) => {
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
    .getByRole("button", {
      name: /Continue to the Reaping/i,
    })
    .click();

  await page
    .getByRole("button", {
      name: /Random Reaping/i,
    })
    .click();

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

  await page
    .getByRole("button", {
      name: "Begin Day 1",
    })
    .click();

  for (let roundIndex = 0; roundIndex < 12; roundIndex += 1) {
    const victoryHeading = page.getByRole("heading", {
      name: "We have a victor",
    });

    if (await victoryHeading.isVisible()) {
      break;
    }

    const revealAllButton = page.getByRole("button", {
      name: "Reveal all events",
    });

    if (await revealAllButton.isVisible()) {
      await revealAllButton.click();
    }

    if (await victoryHeading.isVisible()) {
      break;
    }

    const continueButton = page.getByRole("button", {
      name: /Continue to (Day|Night)/i,
    });

    if (await continueButton.isVisible()) {
      await continueButton.click();
    }
  }

  await expect(
    page.getByRole("heading", {
      name: "We have a victor",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Skip reveal",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "The victor is...",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: /View final statistics/i,
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Final statistics",
    }),
  ).toBeVisible();

  await expect(page.getByText("Deaths by round")).toBeVisible();
});
