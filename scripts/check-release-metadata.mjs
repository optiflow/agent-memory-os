import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const NO_RELEASE_MARKER = /\[no release\]/i;
const VERSION_PR_TITLE = "Version Agent Memory OS";
const VERSION_BRANCH_PREFIX = "changeset-release/";

const changedFiles = getChangedFiles();
const pullRequest = getPullRequestContext();

if (isVersionPullRequest(pullRequest)) {
  console.log("Release metadata check skipped for the Changesets version PR.");
  process.exit(0);
}

if (NO_RELEASE_MARKER.test(`${pullRequest.title}\n${pullRequest.body}`)) {
  console.log("Release metadata check skipped because the PR uses [no release].");
  process.exit(0);
}

const hasChangeset = changedFiles.some(isChangesetSummary);
const releaseRelevantFiles = changedFiles.filter(isReleaseRelevantFile);

if (releaseRelevantFiles.length === 0) {
  console.log("No release-relevant files changed.");
  process.exit(0);
}

if (hasChangeset) {
  console.log("Release metadata check passed: changeset found.");
  process.exit(0);
}

const preview = releaseRelevantFiles.slice(0, 8).join(", ");
const suffix =
  releaseRelevantFiles.length > 8 ? `, and ${releaseRelevantFiles.length - 8} more` : "";
const message =
  "Release-relevant changes do not include a changeset. " +
  "Add one with `pnpm changeset`, or mark the PR with `[no release]` if no release is intended. " +
  `Changed files: ${preview}${suffix}.`;

console.warn(message);
console.log(`::warning title=Missing release metadata::${escapeAnnotation(message)}`);

function getPullRequestContext() {
  const event = readGitHubEvent();
  const pullRequest = isObject(event?.pull_request) ? event.pull_request : {};

  return {
    body: getStringEnv("RELEASE_METADATA_PR_BODY") ?? optionalString(pullRequest.body) ?? "",
    headRef:
      getStringEnv("RELEASE_METADATA_HEAD_REF") ??
      optionalString(isObject(pullRequest.head) ? pullRequest.head.ref : undefined) ??
      getStringEnv("GITHUB_HEAD_REF") ??
      "",
    title: getStringEnv("RELEASE_METADATA_PR_TITLE") ?? optionalString(pullRequest.title) ?? "",
  };
}

function isVersionPullRequest(pullRequest) {
  return (
    pullRequest.title === VERSION_PR_TITLE || pullRequest.headRef.startsWith(VERSION_BRANCH_PREFIX)
  );
}

function getChangedFiles() {
  const explicitFiles = getStringEnv("RELEASE_METADATA_CHANGED_FILES");
  if (explicitFiles) {
    return splitFiles(explicitFiles);
  }

  const event = readGitHubEvent();
  const pullRequest = isObject(event?.pull_request) ? event.pull_request : undefined;
  const baseSha = isObject(pullRequest?.base) ? optionalString(pullRequest.base.sha) : undefined;
  const headSha = isObject(pullRequest?.head) ? optionalString(pullRequest.head.sha) : undefined;

  if (baseSha && headSha) {
    const files = gitChangedFiles([`${baseSha}...${headSha}`]);
    if (files.length > 0) {
      return files;
    }
  }

  const baseRef = getStringEnv("GITHUB_BASE_REF");
  if (baseRef) {
    const originFiles = gitChangedFiles([`origin/${baseRef}...HEAD`]);
    if (originFiles.length > 0) {
      return originFiles;
    }

    const localFiles = gitChangedFiles([`${baseRef}...HEAD`]);
    if (localFiles.length > 0) {
      return localFiles;
    }
  }

  return gitChangedFiles(["HEAD~1...HEAD"]);
}

function gitChangedFiles(rangeArgs) {
  try {
    const output = execFileSync("git", ["diff", "--name-only", ...rangeArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return splitFiles(output);
  } catch {
    return [];
  }
}

function isReleaseRelevantFile(file) {
  if (
    file === "" ||
    file === "CHANGELOG.md" ||
    file === "pnpm-lock.yaml" ||
    file.startsWith("node_modules/") ||
    file.includes("/dist/") ||
    file.includes("/reports/")
  ) {
    return false;
  }

  if (isChangesetSummary(file)) {
    return false;
  }

  return (
    file === ".changeset/config.json" ||
    file === ".devin/wiki.json" ||
    file === ".env.example" ||
    file === "AGENTS.md" ||
    file === "README.md" ||
    file === "biome.json" ||
    file === "lefthook.yml" ||
    file === "package.json" ||
    file === "plugin.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "tsconfig.base.json" ||
    file === "tsconfig.json" ||
    file === "turbo.json" ||
    file.startsWith(".github/workflows/") ||
    file.startsWith("adapters/") ||
    file.startsWith("apps/docs/") ||
    file.startsWith("examples/") ||
    file.startsWith("packages/") ||
    file.startsWith("scripts/") ||
    file.startsWith("skills/")
  );
}

function isChangesetSummary(file) {
  return file.startsWith(".changeset/") && file.endsWith(".md");
}

function splitFiles(value) {
  return [
    ...new Set(
      value
        .split(/\r?\n|,/)
        .map((file) => file.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function readGitHubEvent() {
  const eventPath = getStringEnv("GITHUB_EVENT_PATH");
  if (!eventPath || !existsSync(eventPath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(eventPath, "utf8"));
  } catch {
    return undefined;
  }
}

function getStringEnv(name) {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

function optionalString(value) {
  return typeof value === "string" ? value : undefined;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeAnnotation(value) {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}
