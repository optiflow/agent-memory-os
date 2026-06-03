import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDocsGuard } from "../src/docsGuard.js";

describe("docs guard", () => {
  it("fails when memory behavior changes without Starlight docs", async () => {
    const repoRoot = await createRepo();

    const result = runDocsGuard({
      changedFiles: ["packages/core/src/router.ts"],
      repoRoot,
    });

    expect(result.errors).toContain(
      "Memory behavior changes require a matching Starlight docs update under apps/docs/src/content/docs/.",
    );
  });

  it("passes when memory behavior changes with Starlight docs", async () => {
    const repoRoot = await createRepo();

    const result = runDocsGuard({
      changedFiles: [
        "packages/core/src/router.ts",
        "apps/docs/src/content/docs/architecture/architecture.md",
      ],
      repoRoot,
    });

    expect(result.errors).toEqual([]);
  });

  it("passes adapter changes with Hermes docs", async () => {
    const repoRoot = await createRepo();

    const result = runDocsGuard({
      changedFiles: [
        "adapters/hermes/plugins/memory/meta_memory/__init__.py",
        "adapters/hermes/README.md",
      ],
      repoRoot,
    });

    expect(result.errors).toEqual([]);
  });

  it("passes tooling changes with agent-facing docs", async () => {
    const repoRoot = await createRepo();

    const result = runDocsGuard({
      changedFiles: ["package.json", "AGENTS.md"],
      repoRoot,
    });

    expect(result.errors).toEqual([]);
  });

  it("fails when DeepWiki priority files are missing", async () => {
    const repoRoot = await createRepo({
      wikiPriorityFiles: ["missing/path.md"],
    });

    const result = runDocsGuard({
      changedFiles: [".devin/wiki.json"],
      repoRoot,
    });

    expect(result.errors).toContain(
      '.devin/wiki.json page "Overview" references missing priority file "missing/path.md".',
    );
  });

  it("fails when canonical docs point at deleted root docs files", async () => {
    const repoRoot = await createRepo({
      readme: "See docs/architecture.md for details.",
    });

    const result = runDocsGuard({
      changedFiles: ["README.md"],
      repoRoot,
    });

    expect(result.errors).toContain(
      'Stale root docs reference "docs/architecture.md" found. Canonical docs live under apps/docs/src/content/docs/.',
    );
  });

  it("passes docs-only changes", async () => {
    const repoRoot = await createRepo();

    const result = runDocsGuard({
      changedFiles: ["apps/docs/src/content/docs/reference/evaluation.md"],
      repoRoot,
    });

    expect(result.errors).toEqual([]);
  });
});

async function createRepo(
  options: { readme?: string; wikiPriorityFiles?: string[] } = {},
): Promise<string> {
  const repoRoot = await mkdtemp(join(tmpdir(), "agent-memory-os-docs-guard-"));
  const priorityFiles = options.wikiPriorityFiles ?? [
    "README.md",
    "AGENTS.md",
    "apps/docs/src/content/docs/start/environment.md",
  ];

  const files = new Set([
    "README.md",
    "AGENTS.md",
    "adapters/hermes/README.md",
    "apps/docs/src/content/docs/architecture/architecture.md",
    "apps/docs/src/content/docs/reference/cli-reference.md",
    "apps/docs/src/content/docs/reference/evaluation.md",
    "apps/docs/src/content/docs/start/environment.md",
    ...priorityFiles.filter((file) => !file.startsWith("missing/")),
  ]);

  for (const file of files) {
    await writeFileWithParents(
      join(repoRoot, file),
      file === "README.md" ? (options.readme ?? "# Agent Memory OS\n") : "",
    );
  }

  await writeFileWithParents(
    join(repoRoot, ".devin/wiki.json"),
    `${JSON.stringify(
      {
        repo_notes: [{ content: "Keep docs current." }],
        pages: [
          {
            title: "Overview",
            purpose: "Explain repository purpose.",
            parent: null,
            page_notes: [
              {
                content: `Priority files: ${priorityFiles.join(", ")}.`,
              },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  return repoRoot;
}

async function writeFileWithParents(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
