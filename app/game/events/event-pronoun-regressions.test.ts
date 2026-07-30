import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FORBIDDEN_SINGULAR_EVENT_PHRASES = {
  "app/game/events/catalogue/encounters/accidental-fatal-night-events.ts": [
    "The first snaps beneath them",
    "investigates, they discover",
    "before recognizing them",
    "shelter collapses around them",
    "head from their body",
  ],
  "app/game/events/catalogue/encounters/day-events.ts": [
    "quiet their hunger",
    "their technique until they feel",
  ],
  "app/game/events/catalogue/encounters/day-events-continued.ts": [
    "while they investigate",
    "the nap leaves them renewed",
    "the nap leaves them remarkably well rested",
  ],
  "app/game/events/catalogue/encounters/environmental-events.ts": [
    "loses their footing near a cliff",
    "falls to their death",
  ],
  "app/game/events/catalogue/encounters/night-events.ts": [
    "landmark they recognize",
    "plummeting to their death",
    "rabbit fails to notice them",
    "whatever fabric they can find",
    "and they sleep fine",
    "introduce themselves to whoever",
    "loses their nerve",
    "ask if they can keep each other safe",
    "charging toward them",
    "close their eyes",
    "reject them",
    "rest their legs",
    "branch they apparently mistook",
    "cooks their food",
    "drying their cheeks",
    "dreams that they have escaped",
    "everything they have done",
    "challenge them",
    "attacks them. They feel comforted",
  ],
  "app/game/events/catalogue/encounters/fatal-night-events.ts": [
    "can betray them first",
    "and shoves them into the darkness",
    "rolls them directly into the flames",
    "rolls them into the flames",
    "shaking them awake",
    "covering their mouth",
    "cuts their losses",
    "trips them, pins them",
  ],
  "app/game/events/catalogue/stat-gated/luck/high-events.ts": ["feet they can become"],
} as const;

const HARDCODED_GENDERED_PRONOUN = /\b(?:he|him|his|himself|she|her|hers|herself)\b/i;

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function collectTypeScriptFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, {
      withFileTypes: true,
    })
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectTypeScriptFiles(absolutePath);
      }

      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
        return [];
      }

      return [absolutePath];
    });
}

describe("event pronoun regressions", () => {
  it("does not restore audited hard-coded singular neutral pronouns", () => {
    for (const [relativePath, forbiddenPhrases] of Object.entries(
      FORBIDDEN_SINGULAR_EVENT_PHRASES,
    )) {
      const source = readSource(relativePath);

      for (const phrase of forbiddenPhrases) {
        expect(source, `${relativePath} still contains "${phrase}".`).not.toContain(phrase);
      }
    }
  });

  it("does not hard-code gendered pronouns in event catalogue source", () => {
    const catalogueRoot = path.resolve(process.cwd(), "app/game/events/catalogue");

    const violations = collectTypeScriptFiles(catalogueRoot).flatMap((absolutePath) => {
      const relativePath = path.relative(process.cwd(), absolutePath);

      return fs
        .readFileSync(absolutePath, "utf8")
        .split(/\r?\n/)
        .flatMap((line, index) =>
          HARDCODED_GENDERED_PRONOUN.test(line)
            ? [`${relativePath}:${index + 1}: ${line.trim()}`]
            : [],
        );
    });

    expect(violations).toEqual([]);
  });
});
