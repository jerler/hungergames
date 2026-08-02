import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const EVENT_FREQUENCY_REPORT_SCHEMA_VERSION = "3.0.0";
export const EVENT_FREQUENCY_GENERATOR_VERSION = "phase-0-provenance-v1";

export interface EventFrequencyReportProvenance {
  commitSha: string;
  schemaVersion: string;
  generatorVersion: string;
  generatorPath: string;
  generatorSha256: string;
}

export interface ClaimedReportOutputDirectory {
  outputDirectory: string;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

function createUniqueSiblingPath(outputDirectory: string, suffix: string): string {
  return `${outputDirectory}.${suffix}-${process.pid}-${Date.now()}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function isDirectoryEmpty(path: string): Promise<boolean> {
  return (await readdir(path)).length === 0;
}

export function getCurrentCommitSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

export async function calculateFileSha256(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const contents = await readFile(path);

  return createHash("sha256").update(contents).digest("hex");
}

export async function createEventFrequencyReportProvenance(
  generatorPath = "scripts/generate-event-frequency-report.ts",
): Promise<EventFrequencyReportProvenance> {
  const absoluteGeneratorPath = resolve(process.cwd(), generatorPath);

  return {
    commitSha: getCurrentCommitSha(),
    schemaVersion: EVENT_FREQUENCY_REPORT_SCHEMA_VERSION,
    generatorVersion: EVENT_FREQUENCY_GENERATOR_VERSION,
    generatorPath,
    generatorSha256: await calculateFileSha256(absoluteGeneratorPath),
  };
}

/**
 * Exclusively claims a report destination for one generator process.
 *
 * A nonempty destination is rejected by default. With overwrite enabled, the
 * previous directory is renamed to a private sibling before a fresh output
 * directory is created. A failed generation can therefore restore the complete
 * previous report instead of leaving it partially replaced.
 */
export async function claimReportOutputDirectory(
  requestedOutputDirectory: string,
  overwrite: boolean,
): Promise<ClaimedReportOutputDirectory> {
  const outputDirectory = resolve(process.cwd(), requestedOutputDirectory);
  const parentDirectory = dirname(outputDirectory);
  const lockDirectory = `${outputDirectory}.event-frequency-report.lock`;
  let backupDirectory: string | null = null;
  let finalized = false;

  await mkdir(parentDirectory, { recursive: true });

  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(
        `Report output directory "${requestedOutputDirectory}" is already claimed by another audit process.`,
        { cause: error },
      );
    }

    throw error;
  }

  try {
    if (!(await pathExists(outputDirectory))) {
      await mkdir(outputDirectory);
    } else if (!(await isDirectoryEmpty(outputDirectory))) {
      if (!overwrite) {
        throw new Error(
          `Report output directory "${requestedOutputDirectory}" is not empty. ` +
            "Choose a new directory or pass --overwrite explicitly.",
        );
      }

      backupDirectory = createUniqueSiblingPath(outputDirectory, "pre-overwrite-backup");
      await rename(outputDirectory, backupDirectory);
      await mkdir(outputDirectory);
    }

    const removeLock = async (): Promise<void> => {
      await rm(lockDirectory, { recursive: true, force: true });
    };

    return {
      outputDirectory,
      async commit(): Promise<void> {
        if (finalized) {
          return;
        }

        finalized = true;

        if (backupDirectory) {
          await rm(backupDirectory, { recursive: true, force: true });
        }

        await removeLock();
      },
      async rollback(): Promise<void> {
        if (finalized) {
          return;
        }

        finalized = true;
        await rm(outputDirectory, { recursive: true, force: true });

        if (backupDirectory) {
          await rename(backupDirectory, outputDirectory);
        }

        await removeLock();
      },
    };
  } catch (error) {
    await rm(lockDirectory, { recursive: true, force: true });
    throw error;
  }
}
