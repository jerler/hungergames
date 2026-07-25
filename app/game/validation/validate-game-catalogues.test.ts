import { describe, expect, it } from "vitest";

import { validateGameCatalogues } from "./validate-game-catalogues";

describe("production game catalogues", () => {
  it("satisfies every catalogue contract", () => {
    expect(() => validateGameCatalogues()).not.toThrow();
  });
});
