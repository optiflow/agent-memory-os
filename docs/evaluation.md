# Evaluation Plan

Evaluation starts with deterministic local gates. Memory benchmarks are useful
only after the adapter contract and v1 data paths are stable.

## Local Acceptance

The repo should pass:

```bash
pnpm lint
pnpm lint:packages
pnpm lint:repo
pnpm typecheck
pnpm test
pnpm build
pnpm adapter:check
pnpm run ci
```

`pnpm run ci` is the expected pull-request gate and runs lint, typecheck, tests,
build, and adapter checks.

Python checks are adapter-boundary checks only. TypeScript owns memory ranking,
schema, persistence, routing, verification policy, and product behavior.

## CLI Smoke Test

```bash
pnpm --filter @agent-memory-os/cli build
tmp_dir="$(mktemp -d)"
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\"}" | node packages/cli/dist/index.js seed-sample
echo "{\"dbPath\":\"$tmp_dir/memory.sqlite\",\"query\":\"Biome formatter\",\"budgetTokens\":400}" \
  | node packages/cli/dist/index.js context-pack
```

Expected result:

- the first command returns sample core, event, and fact records;
- the second command returns `contextPack`;
- the context pack includes the seeded Biome memory;
- citations are present on included items.

## Adapter Smoke Test

```bash
python3 -m py_compile adapters/hermes/plugins/memory/meta_memory/__init__.py
python3 -m unittest discover adapters/hermes/plugins/memory/meta_memory/test
pnpm adapter:check
```

Before real Hermes integration testing, verify the target Hermes plugin contract
and update the smoke fixture to cover the actual discovery mechanism.

## Current Coverage

Current local tests cover:

- FTS search returns evidence and facts;
- context packing respects token budgets;
- CLI seed and context-pack smoke behavior;
- adapter tool-call arguments cannot override configured `META_MEMORY_DB`;
- adapter CLI failure handling.

## Future V1 Behavior Gaps

Future v1 feature work should add tests for:

- write path preserves evidence before derived facts;
- verification warnings appear in packs;
- adapter subprocess timeouts fail clearly;
- real Hermes plugin discovery for a target Hermes version.

## Quality Metrics

- Tokens injected per turn.
- Context-pack generation latency.
- Search latency.
- Context-pack citation coverage.
- Verification warning rate.
- Stale or unsupported memory rate.
- Wrong answers caused by write-side loss versus retrieval-side loss.

## Benchmark Direction

Use conversational recall and temporal-reasoning benchmarks for broad memory
quality, then add environment-experience tests for coding-agent workflows.

The key acceptance criterion is not raw recall alone; it is avoiding stale,
irrelevant, unsupported, or branch-invalid injection.

External benchmarks from the report should stay future-facing until v1 has a
stable Hermes integration path.
