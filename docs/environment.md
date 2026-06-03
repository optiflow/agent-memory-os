# Environment

This repo is prepared for local-first Hermes memory development. Keep the
environment simple while V1/V1.1 remains SQLite + FTS and adapter-boundary
verified locally.

## Verified Local Baseline

The current local checkout was verified with:

| Tool | Version |
| --- | --- |
| Node.js | `v24.15.0` |
| pnpm | `11.5.1` |
| Python | `3.14.5` |

The root `package.json` declares Node 24.x as the supported runtime baseline.
Node's built-in `node:sqlite` module is a runtime constraint for this repo.

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

1. Confirm Hermes target version, `plugin.yaml` fields, `register(ctx)`
   discovery, any `initialize(...)` behavior, lifecycle hooks, and tool schema
   registration.
2. Run `pnpm run ci` from a clean branch.
3. Build the CLI before adapter smoke testing.
4. Keep Browser verification out of scope unless a web target is added.
