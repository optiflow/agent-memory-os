import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type DocsGuardResult = {
  changedFiles: string[];
  errors: string[];
};

export type DocsGuardOptions = {
  changedFiles: string[];
  repoRoot: string;
};

type WikiPage = {
  title?: unknown;
  parent?: unknown;
  page_notes?: Array<{ content?: unknown }>;
};

const STARLIGHT_DOCS_PREFIX = "apps/docs/src/content/docs/";
const CLI_REFERENCE = `${STARLIGHT_DOCS_PREFIX}reference/cli-reference.md`;
const EVALUATION_DOC = `${STARLIGHT_DOCS_PREFIX}reference/evaluation.md`;
const ENVIRONMENT_DOC = `${STARLIGHT_DOCS_PREFIX}start/environment.md`;
const HERMES_INSTALL_DOC = `${STARLIGHT_DOCS_PREFIX}integrations/hermes-install.md`;

const DOC_REFERENCE_SCAN_PATHS = [
  "README.md",
  "AGENTS.md",
  ".devin/wiki.json",
  "adapters/hermes/README.md",
  STARLIGHT_DOCS_PREFIX,
];

export function runDocsGuard(options: DocsGuardOptions): DocsGuardResult {
  const changedFiles = normalizeChangedFiles(options.changedFiles);
  const errors = [
    ...validateChangedFileRules(changedFiles),
    ...validateWikiJson(options.repoRoot),
    ...validateRootDocsReferences(options.repoRoot),
  ];

  return {
    changedFiles,
    errors,
  };
}

export function getChangedFiles(repoRoot: string): string[] {
  const explicitFiles = process.env.DOCS_GUARD_CHANGED_FILES;
  if (explicitFiles) {
    return explicitFiles
      .split(/\r?\n|,/)
      .map((file) => file.trim())
      .filter(Boolean);
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    return getGitHubChangedFiles(repoRoot);
  }

  const localFiles = [
    ...gitLines(repoRoot, ["diff", "--name-only", "--cached"]),
    ...gitLines(repoRoot, ["diff", "--name-only"]),
    ...gitLines(repoRoot, ["ls-files", "--others", "--exclude-standard"]),
  ];

  if (localFiles.length > 0) {
    return localFiles;
  }

  return gitLines(repoRoot, ["diff", "--name-only", "HEAD~1...HEAD"]);
}

function getGitHubChangedFiles(repoRoot: string): string[] {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    const againstOrigin = gitLines(repoRoot, ["diff", "--name-only", `origin/${baseRef}...HEAD`]);
    if (againstOrigin.length > 0) {
      return againstOrigin;
    }

    const againstLocal = gitLines(repoRoot, ["diff", "--name-only", `${baseRef}...HEAD`]);
    if (againstLocal.length > 0) {
      return againstLocal;
    }
  }

  const beforeSha = getGitHubBeforeSha();
  if (beforeSha && !/^0+$/.test(beforeSha)) {
    const pushedFiles = gitLines(repoRoot, ["diff", "--name-only", `${beforeSha}...HEAD`]);
    if (pushedFiles.length > 0) {
      return pushedFiles;
    }
  }

  return gitLines(repoRoot, ["diff", "--name-only", "HEAD~1...HEAD"]);
}

function getGitHubBeforeSha(): string | undefined {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) {
    return undefined;
  }

  try {
    const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
      before?: unknown;
    };
    return typeof event.before === "string" ? event.before : undefined;
  } catch {
    return undefined;
  }
}

function gitLines(repoRoot: string, args: string[]): string[] {
  try {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function validateChangedFileRules(changedFiles: string[]): string[] {
  const errors: string[] = [];

  const hasStarlightDocs = changedFiles.some(isStarlightDoc);
  const hasReadmeOrAgents = changedFiles.some((file) => ["README.md", "AGENTS.md"].includes(file));
  const hasHermesDocs = changedFiles.some(
    (file) => file === "adapters/hermes/README.md" || file === HERMES_INSTALL_DOC,
  );
  const hasToolingDocs = changedFiles.some(
    (file) => file === "AGENTS.md" || file === ENVIRONMENT_DOC || file === EVALUATION_DOC,
  );

  if (changedFiles.some(isMemoryBehaviorChange) && !hasStarlightDocs) {
    errors.push(
      `Memory behavior changes require a matching Starlight docs update under ${STARLIGHT_DOCS_PREFIX}.`,
    );
  }

  if (changedFiles.some(isCliSurfaceChange)) {
    if (!changedFiles.includes(CLI_REFERENCE)) {
      errors.push(`CLI surface changes require ${CLI_REFERENCE}.`);
    }
    if (!hasReadmeOrAgents) {
      errors.push("User-facing CLI surface changes require README.md or AGENTS.md.");
    }
  }

  if (changedFiles.some(isHermesAdapterChange) && !hasHermesDocs) {
    errors.push(
      `Hermes adapter or plugin changes require adapters/hermes/README.md or ${HERMES_INSTALL_DOC}.`,
    );
  }

  if (changedFiles.some(isToolingOrPolicyChange) && !hasToolingDocs) {
    errors.push(
      `Tooling and policy changes require AGENTS.md, ${ENVIRONMENT_DOC}, or ${EVALUATION_DOC}.`,
    );
  }

  return errors;
}

function validateWikiJson(repoRoot: string): string[] {
  const wikiPath = join(repoRoot, ".devin/wiki.json");
  if (!existsSync(wikiPath)) {
    return [".devin/wiki.json is required for DeepWiki steering."];
  }

  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(wikiPath, "utf8"));
  } catch (error) {
    return [`.devin/wiki.json is not valid JSON: ${formatError(error)}.`];
  }

  if (!isObject(parsed)) {
    return [".devin/wiki.json must contain a JSON object."];
  }

  const repoNotes = parsed.repo_notes;
  if (!Array.isArray(repoNotes) || repoNotes.length === 0) {
    errors.push(".devin/wiki.json must define non-empty repo_notes.");
  }

  const pages = parsed.pages;
  if (pages !== undefined && !Array.isArray(pages)) {
    errors.push(".devin/wiki.json pages must be an array when present.");
    return errors;
  }

  if (Array.isArray(pages)) {
    if (pages.length > 30) {
      errors.push(".devin/wiki.json pages must not exceed DeepWiki's 30-page limit.");
    }

    const titles = new Set<string>();
    for (const [index, page] of pages.entries()) {
      if (!isObject(page)) {
        errors.push(`.devin/wiki.json pages[${index}] must be an object.`);
        continue;
      }

      const wikiPage = page as WikiPage;
      if (typeof wikiPage.title !== "string" || wikiPage.title.trim() === "") {
        errors.push(`.devin/wiki.json pages[${index}] must define a title.`);
        continue;
      }

      if (titles.has(wikiPage.title)) {
        errors.push(`.devin/wiki.json has duplicate page title "${wikiPage.title}".`);
      }
      titles.add(wikiPage.title);
    }

    for (const [index, page] of pages.entries()) {
      if (!isObject(page)) {
        continue;
      }

      const wikiPage = page as WikiPage;
      if (
        typeof wikiPage.parent === "string" &&
        wikiPage.parent.trim() !== "" &&
        !titles.has(wikiPage.parent)
      ) {
        errors.push(
          `.devin/wiki.json page "${wikiPage.title ?? index}" references missing parent "${wikiPage.parent}".`,
        );
      }

      for (const priorityFile of extractPriorityFiles(wikiPage)) {
        if (!existsSync(join(repoRoot, priorityFile))) {
          errors.push(
            `.devin/wiki.json page "${wikiPage.title ?? index}" references missing priority file "${priorityFile}".`,
          );
        }
      }
    }
  }

  return errors;
}

function extractPriorityFiles(page: WikiPage): string[] {
  const files: string[] = [];
  for (const note of page.page_notes ?? []) {
    if (typeof note.content !== "string") {
      continue;
    }

    const match = note.content.match(/Priority files:\s*(.+)$/);
    if (!match?.[1]) {
      continue;
    }

    for (const rawPath of match[1].split(",")) {
      const file = rawPath.trim().replace(/\.$/, "");
      if (file) {
        files.push(file);
      }
    }
  }
  return files;
}

function validateRootDocsReferences(repoRoot: string): string[] {
  const errors: string[] = [];
  const references = new Set<string>();

  for (const filePath of docsReferenceScanFiles(repoRoot)) {
    const content = readFileSync(join(repoRoot, filePath), "utf8");
    for (const match of content.matchAll(/\bdocs\/[A-Za-z0-9_./-]+\.md\b/g)) {
      const previousCharacter =
        match.index === undefined || match.index === 0 ? "" : content[match.index - 1];
      if (previousCharacter && /[A-Za-z0-9_./-]/.test(previousCharacter)) {
        continue;
      }
      references.add(match[0]);
    }
  }

  for (const reference of references) {
    const isRetainedResearch =
      reference.startsWith("docs/research/") && existsSync(join(repoRoot, reference));
    if (!isRetainedResearch) {
      errors.push(
        `Stale root docs reference "${reference}" found. Canonical docs live under ${STARLIGHT_DOCS_PREFIX}.`,
      );
    }
  }

  return errors;
}

function docsReferenceScanFiles(repoRoot: string): string[] {
  const files: string[] = [];

  for (const scanPath of DOC_REFERENCE_SCAN_PATHS) {
    const absolutePath = join(repoRoot, scanPath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    if (statSync(absolutePath).isDirectory()) {
      files.push(...walkFiles(absolutePath, repoRoot));
    } else {
      files.push(normalizePath(relative(repoRoot, absolutePath)));
    }
  }

  return files.filter((file) => file.endsWith(".md") || file.endsWith(".json"));
}

function walkFiles(directory: string, repoRoot: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath, repoRoot));
    } else {
      files.push(normalizePath(relative(repoRoot, entryPath)));
    }
  }
  return files;
}

function normalizeChangedFiles(files: string[]): string[] {
  return [...new Set(files.map(normalizePath).filter(Boolean))].sort();
}

function normalizePath(filePath: string): string {
  return filePath.split(sep).join("/").replace(/^\.\//, "");
}

function isStarlightDoc(file: string): boolean {
  return file.startsWith(STARLIGHT_DOCS_PREFIX);
}

function isMemoryBehaviorChange(file: string): boolean {
  return [
    "packages/core/src/",
    "packages/core/test/",
    "packages/sqlite/src/",
    "packages/sqlite/test/",
    "packages/evals/src/",
    "packages/evals/test/",
  ].some((prefix) => file.startsWith(prefix));
}

function isCliSurfaceChange(file: string): boolean {
  return file.startsWith("packages/cli/src/") || file === "packages/cli/package.json";
}

function isHermesAdapterChange(file: string): boolean {
  return (
    file === "__init__.py" ||
    file === "plugin.yaml" ||
    (file.startsWith("adapters/hermes/") && file !== "adapters/hermes/README.md") ||
    file.startsWith("skills/agent-memory-os-setup/")
  );
}

function isToolingOrPolicyChange(file: string): boolean {
  return (
    file === ".env.example" ||
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "turbo.json" ||
    file === "biome.json" ||
    file === "lefthook.yml" ||
    file === "tsconfig.json" ||
    file === "tsconfig.base.json" ||
    file.startsWith(".github/workflows/") ||
    file.startsWith("packages/docs-guard/")
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
