import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",

  fullyParallel: true,

  forbidOnly: Boolean(process.env.CI),

  retries: process.env.CI ? 2 : 0,

  reporter: [
    ["list"],

    [
      "html",
      {
        open: "never",
      },
    ],
  ],

  use: {
    baseURL: BASE_URL,

    trace: "on-first-retry",

    screenshot: "only-on-failure",

    video: "retain-on-failure",
  },

  webServer: {
    command: "npm run preview",

    url: BASE_URL,

    /*
     * Release validation must not silently connect to
     * a stale server left over from another process.
     */
    reuseExistingServer: false,
  },

  projects: [
    {
      name: "chromium",

      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
