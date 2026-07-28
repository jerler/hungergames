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
      name: "The tributes enter the arena.",
    }),
  ).toBeVisible();

  await expect(page.getByText(/The 12 tributes stand on their platforms/i)).toBeVisible();

  await page
    .getByRole("button", {
      name: "Fire the cannon",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Ran for the Cornucopia...",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Continue to the Bloodbath",
    })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Reveal next event",
    }),
  ).toBeVisible();

  for (let roundIndex = 0; roundIndex < 50; roundIndex += 1) {
    const victoryHeading = page.getByRole("heading", {
      name: /The Games have (?:a victor|victors)/i,
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

    const nightSummaryButton = page.getByRole("button", {
      name: "View night summary",
    });

    if (await nightSummaryButton.isVisible()) {
      await nightSummaryButton.click();

      await expect(
        page.getByRole("heading", {
          name: "The Fallen and the Remaining",
        }),
      ).toBeVisible();
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
      name: /The Games have (?:a victor|victors)/i,
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Skip ceremony",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: /enters the history of Panem|Two names enter the history of Panem/i,
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
