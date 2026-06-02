#!/usr/bin/env node
import type { CommandInput, CommandName } from "./commands.js";
import { runCommand } from "./commands.js";

async function readStdin(): Promise<string> {
  let body = "";

  for await (const chunk of process.stdin) {
    body += chunk;
  }

  return body;
}

async function main(): Promise<void> {
  const command = process.argv[2] as CommandName | undefined;

  if (!command) {
    throw new Error("Usage: meta-memory <remember|search|context-pack|verify|seed-sample>");
  }

  const body = await readStdin();
  const input = body.trim().length > 0 ? (JSON.parse(body) as CommandInput) : {};
  const output = await runCommand(command, input);

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 1;
});
