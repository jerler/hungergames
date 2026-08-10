import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const EVENT_FREQUENCY_REPORT_SCHEMA_VERSION = "4.1.0";
export const EVENT_FREQUENCY_GENERATOR_VERSION = "phase-2-roster-strategy-evidence-v1";

export interface EventFrequencyReportProvenance {
  commitSha: string;
  schemaVersion: string;
  generatorVersion: string;
  generatorPath: string;
  generatorSha256: string;
  worktreeState: "clean" | "dirty";
  worktreeStatusSha256: string;
  sourceTreeSha256: string;
  sourceFileCount: number;
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

function runGit(args: readonly string[]): Buffer {
  return execFileSync("git", [...args], {
    cwd: process.cwd(),
  });
}

function parseNullSeparated(buffer: Buffer): string[] {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter((value) => value.length > 0);
}

export function getCurrentCommitSha(): string {
  return runGit(["rev-parse", "HEAD"]).toString("utf8").trim();
}

export async function calculateFileSha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

export async function calculateSourceTreeSha256(
  rootDirectory: string,
  relativePaths: readonly string[],
): Promise<string> {
  const hash = createHash("sha256");

  for (const relativePath of [...new Set(relativePaths)].sort()) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    const absolutePath = resolve(rootDirectory, relativePath);

    hash.update(normalizedPath);
    hash.update("\0");

    try {
      const metadata = await stat(absolutePath);

      if (metadata.isFile()) {
        hash.update(await readFile(absolutePath));
      } else {
        hash.update("<non-file>");
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        hash.update("<deleted>");
      } else {
        throw error;
      }
    }

    hash.update("\0");
  }

  return hash.digest("hex");
}

function getRepositorySourcePaths(): string[] {
  return parseNullSeparated(
    runGit(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]),
  );
}

export async function createEventFrequencyReportProvenance({
  generatorPath = "scripts/generate-event-frequency-report.ts",
  allowDirty = false,
}: {
  generatorPath?: string;
  allowDirty?: boolean;
} = {}): Promise<EventFrequencyReportProvenance> {
  const worktreeStatus = runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const worktreeState = worktreeStatus.length === 0 ? "clean" : "dirty";

  if (worktreeState === "dirty" && !allowDirty) {
    throw new Error(
      "Event-frequency audits require a clean worktree so the " +
        "recorded commit identifies the exact source. Commit or " +
        "stash the changes, or pass --allow-dirty only for a " +
        "non-baseline smoke run.",
    );
  }

  const sourcePaths = getRepositorySourcePaths();

  return {
    commitSha: getCurrentCommitSha(),
    schemaVersion: EVENT_FREQUENCY_REPORT_SCHEMA_VERSION,
    generatorVersion: EVENT_FREQUENCY_GENERATOR_VERSION,
    generatorPath,
    generatorSha256: await calculateFileSha256(resolve(process.cwd(), generatorPath)),
    worktreeState,
    worktreeStatusSha256: createHash("sha256").update(worktreeStatus).digest("hex"),
    sourceTreeSha256: await calculateSourceTreeSha256(process.cwd(), sourcePaths),
    sourceFileCount: sourcePaths.length,
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
        `Report output directory "${requestedOutputDirectory}" ` +
          "is already claimed by another audit process.",
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
          `Report output directory "${requestedOutputDirectory}" ` +
            "is not empty. Choose a new directory or pass " +
            "--overwrite explicitly.",
        );
      }

      backupDirectory = createUniqueSiblingPath(outputDirectory, "pre-overwrite-backup");
      await rename(outputDirectory, backupDirectory);
      await mkdir(outputDirectory);
    }

    const removeLock = async (): Promise<void> => {
      await rm(lockDirectory, {
        recursive: true,
        force: true,
      });
    };

    return {
      outputDirectory,
      async commit(): Promise<void> {
        if (finalized) {
          return;
        }

        finalized = true;

        if (backupDirectory) {
          await rm(backupDirectory, {
            recursive: true,
            force: true,
          });
        }

        await removeLock();
      },
      async rollback(): Promise<void> {
        if (finalized) {
          return;
        }

        finalized = true;
        await rm(outputDirectory, {
          recursive: true,
          force: true,
        });

        if (backupDirectory) {
          await rename(backupDirectory, outputDirectory);
        }

        await removeLock();
      },
    };
  } catch (error) {
    await rm(lockDirectory, {
      recursive: true,
      force: true,
    });
    throw error;
  }
}
