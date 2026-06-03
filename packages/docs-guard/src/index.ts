#!/usr/bin/env node
import { cwd } from "node:process";
import { getChangedFiles, runDocsGuard } from "./docsGuard.js";

const result = runDocsGuard({
  changedFiles: getChangedFiles(cwd()),
  repoRoot: cwd(),
});

if (result.errors.length > 0) {
  console.error("Documentation freshness gate failed.");
  console.error("");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  console.error("");
  console.error("Changed files considered by docs guard:");
  for (const file of result.changedFiles) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log("Documentation freshness gate passed.");
}
