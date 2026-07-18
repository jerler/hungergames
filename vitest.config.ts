import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(rootDirectory, "app"),
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],

    include: [
      "app/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],

    exclude: [
      ...configDefaults.exclude,
      "tests/e2e/**",
    ],
  },
});