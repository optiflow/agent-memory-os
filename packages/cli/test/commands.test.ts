import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/commands.js";

describe("runCommand", () => {
  it("seeds sample memory and returns a bounded context pack", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agent-memory-os-"));
    const dbPath = join(dir, "memory.sqlite");

    try {
      await runCommand("seed-sample", { dbPath });
      const output = await runCommand("context-pack", {
        dbPath,
        query: "Biome formatter",
        budgetTokens: 400,
      });

      expect(JSON.stringify(output)).toContain("Biome");
      expect(JSON.stringify(output)).toContain("contextPack");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
