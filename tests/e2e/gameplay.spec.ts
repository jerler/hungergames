import { expect, test } from "@playwright/test";

test("runs a local Game through its victory sequence", async ({ page }) => {
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

  await expect(
    page.getByRole("heading", {
      name: "Prepare the tributes",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: /Randomize all/i,
    })
    .click();

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

  await page
    .getByRole("button", {
      name: "Begin Day 1",
    })
    .click();

  for (let roundIndex = 0; roundIndex < 50; roundIndex += 1) {
    const victoryHeading = page.getByRole("heading", {
      name: /We have (?:a victor|victors)/i,
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

    const revealVictorButton = page.getByRole("button", {
      name: "Reveal the victor",
    });

    if (await revealVictorButton.isVisible()) {
      await expect(revealVictorButton).toBeVisible();

      await revealVictorButton.click();
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
      name: /We have (?:a victor|victors)/i,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Skip reveal",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: /The victor is\.\.\.|The victors are\.\.\./i,
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
