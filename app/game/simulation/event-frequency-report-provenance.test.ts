import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  EVENT_FREQUENCY_GENERATOR_VERSION,
  EVENT_FREQUENCY_REPORT_SCHEMA_VERSION,
  calculateFileSha256,
  claimReportOutputDirectory,
} from "../../../scripts/event-frequency-report-provenance";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "event-frequency-phase-0-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("event-frequency report provenance", () => {
  it("uses explicit stable schema and generator versions", () => {
    expect(EVENT_FREQUENCY_REPORT_SCHEMA_VERSION).toBe("3.0.0");
    expect(EVENT_FREQUENCY_GENERATOR_VERSION).toBe("phase-0-provenance-v1");
  });

  it("calculates a deterministic SHA-256 checksum", async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, "generator.ts");
    await writeFile(path, "export const value = 1;\n", "utf8");

    expect(await calculateFileSha256(path)).toBe(
      "5d8f65d2774e206bc9f7a7a4ad39ca2dc563b5c31e46ab57ef4874961237ce29",
    );
  });
});

describe("event-frequency report output claiming", () => {
  it("creates and commits a previously absent output directory", async () => {
    const parent = await createTemporaryDirectory();
    const output = join(parent, "report");

    const claim = await claimReportOutputDirectory(output, false);
    await writeFile(join(claim.outputDirectory, "report.json"), "{}\n", "utf8");
    await claim.commit();

    expect(await readFile(join(output, "report.json"), "utf8")).toBe("{}\n");
  });

  it("rejects a nonempty output directory without --overwrite", async () => {
    const parent = await createTemporaryDirectory();
    const output = join(parent, "report");
    await mkdir(output);
    await writeFile(join(output, "baseline.txt"), "preserve me\n", "utf8");

    await expect(claimReportOutputDirectory(output, false)).rejects.toThrow(
      /not empty.*--overwrite/i,
    );
    expect(await readFile(join(output, "baseline.txt"), "utf8")).toBe("preserve me\n");
  });

  it("restores the complete previous directory when an overwrite run fails", async () => {
    const parent = await createTemporaryDirectory();
    const output = join(parent, "report");
    await mkdir(output);
    await writeFile(join(output, "baseline.txt"), "preserve me\n", "utf8");

    const claim = await claimReportOutputDirectory(output, true);
    await writeFile(join(claim.outputDirectory, "partial.txt"), "partial\n", "utf8");
    await claim.rollback();

    expect(await readFile(join(output, "baseline.txt"), "utf8")).toBe("preserve me\n");
    await expect(readFile(join(output, "partial.txt"), "utf8")).rejects.toThrow();
  });

  it("replaces the previous directory only after an overwrite run commits", async () => {
    const parent = await createTemporaryDirectory();
    const output = join(parent, "report");
    await mkdir(output);
    await writeFile(join(output, "baseline.txt"), "old\n", "utf8");

    const claim = await claimReportOutputDirectory(output, true);
    await writeFile(join(claim.outputDirectory, "report.json"), "new\n", "utf8");
    await claim.commit();

    expect(await readFile(join(output, "report.json"), "utf8")).toBe("new\n");
    await expect(readFile(join(output, "baseline.txt"), "utf8")).rejects.toThrow();
  });
});
