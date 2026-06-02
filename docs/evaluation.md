# Evaluation Plan

## Local Acceptance

The repo should pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm adapter:check
pnpm run ci
```

The CLI should support a local smoke test:

```bash
pnpm --filter @agent-memory-os/cli build
echo '{"dbPath":"./memory.sqlite"}' | node packages/cli/dist/index.js seed-sample
echo '{"dbPath":"./memory.sqlite","query":"Biome formatter","budgetTokens":400}' \
  | node packages/cli/dist/index.js context-pack
```

## Quality Metrics

- Tokens injected per turn.
- Retrieval latency.
- Verified-memory hit rate.
- Stale-memory warning rate.
- Context-pack citation coverage.

## Benchmark Direction

Use conversational recall and temporal-reasoning benchmarks for broad memory quality, then add environment-experience tests for coding-agent workflows. The key acceptance criterion is not raw recall alone; it is avoiding stale, irrelevant, or branch-invalid injection.
