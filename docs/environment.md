# Environment

This repo is prepared for local-first Hermes memory development. Keep the
environment simple until the adapter contract and v1 behavior are proven.

## Verified Local Baseline

The current local checkout was verified with:

| Tool | Version |
| --- | --- |
| Node.js | `v24.15.0` |
| pnpm | `11.2.2` |
| Python | `3.14.5` |

The root `package.json` keeps conservative minimums so development can start on
supported Node 22+ environments. Node's built-in `node:sqlite` module is still a
runtime constraint for this repo; prefer current Node 24.x for active work.

## Setup

```bash
corepack enable pnpm
pnpm install
pnpm run ci
```

The committed `pnpm-lock.yaml` is the shared dependency source of truth. Do not
replace pnpm with npm, Yarn, or Bun for repo orchestration.

## Hermes Adapter Variables

Copy `.env.example` when you need local shell defaults:

```bash
cp .env.example .env
```

Required adapter settings:

| Variable | Purpose |
| --- | --- |
| `META_MEMORY_CLI` | Command the Python adapter uses to invoke the TypeScript CLI. |
| `META_MEMORY_DB` | Local SQLite file for the provider. |
| `META_MEMORY_TIMEOUT_SECONDS` | Adapter subprocess timeout. |

Do not commit `.env` or local SQLite files.

## Pre-Development Checks

Before starting feature work:

1. Confirm Hermes target version and memory plugin discovery behavior.
2. Run `pnpm run ci` from a clean branch.
3. Build the CLI before adapter smoke testing.
4. Keep Browser verification out of scope unless a web target is added.
