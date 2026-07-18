import { describe, expect, it } from "vitest";

import { MAX_PORTRAIT_FILE_SIZE_BYTES, validatePortraitFile } from "./portrait-file";

describe("validatePortraitFile", () => {
  it("accepts supported image formats", () => {
    const file = new File(["portrait"], "portrait.png", {
      type: "image/png",
    });

    expect(validatePortraitFile(file)).toBeNull();
  });

  it("rejects unsupported formats", () => {
    const file = new File(["portrait"], "portrait.gif", {
      type: "image/gif",
    });

    expect(validatePortraitFile(file)).toBe("Choose a JPEG, PNG, or WebP image.");
  });

  it("rejects files larger than five megabytes", () => {
    const file = new File(
      [new Uint8Array(MAX_PORTRAIT_FILE_SIZE_BYTES + 1)],
      "large-portrait.png",
      {
        type: "image/png",
      },
    );

    expect(validatePortraitFile(file)).toBe("Portraits must be 5 MB or smaller.");
  });
});
