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

  await expect(
    page.getByRole("link", {
      name: /Made by Julie/i,
    }),
  ).toHaveAttribute("href", "https://madebyjulie.dev");

  const creatorLink = page.locator(".landing-header").getByRole("link", {
    name: /Made by Julie/i,
  });

  await expect(creatorLink).toHaveAttribute("href", "https://madebyjulie.dev");

  await expect(
    page.getByRole("link", {
      name: /Join a room/i,
    }),
  ).toHaveCount(0);
});
