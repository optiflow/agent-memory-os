#!/usr/bin/env node
import type { CommandInput } from "./commands.js";
import { parseCommandName, runCommand } from "./commands.js";

async function readStdin(): Promise<string> {
  let body = "";

  for await (const chunk of process.stdin) {
    body += chunk;
  }

  return body;
}

function parseCommandInput(body: string): CommandInput {
  if (body.trim().length === 0) {
    return {};
  }

  const input = JSON.parse(body) as unknown;

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Expected stdin JSON to be an object");
  }

  return input as CommandInput;
}

async function main(): Promise<void> {
  const command = parseCommandName(process.argv[2]);

  const body = await readStdin();
  const input = parseCommandInput(body);
  const output = await runCommand(command, input);

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 1;
});
