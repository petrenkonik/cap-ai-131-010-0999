# cap-ai-mcp-whats-new

Demo project for the coordinated **@cap-js/ai 1.3.0** + **@cap-js/mcp-server 0.1.0** releases (2026-10-26). TypeScript only, zero build step — Node 24 type stripping loads `.mts` natively.

## What's demoed

| Release feature | Test |
|---|---|
| **Fail-fast env validation** (0.1.0): every `CDS_MCP_*` var checked by `lib/utils.js` — timeouts at import time, `CDS_MCP_MAX_RESULTS` per search call | `test/config-validation.test.mts` |
| **Runtime-aware hybrid search** (0.1.0): `hybridSearch(..., { runtime })` drops chunks labelled with the other runtime before cosine + BM25 (FTS5) + weighted RRF; unlabelled chunks always stay; `runtime: undefined` = old behaviour | `test/runtime-filter.test.mts` |
| **`installModel` public entrypoint** (1.3.0): `import { installModel } from '@cap-js/ai/models.js'` — programmatic model provisioning without CAP plugin hooks on import | `test/ai-api.test.mts` |
| `cds-ai` CLI still healthy after the 1.3.0 refactor (progress/stall-timeout rework) | `test/ai-api.test.mts` |

## Run

```bash
npm install
npm test          # 8 tests; the runtime-filter test downloads BAAI/bge-small-en-v1.5 (~30 MB) on first use
```

## Pitfalls found while building this

- **Chunk shape**: the BM25/FTS5 path binds `chunk.content` — not `text`. A chunk without `content` dies with `TypeError: Provided value cannot be bound to SQLite parameter 2`.
- **Env validation timing differs**: `CDS_MCP_MANIFEST_TIMEOUT` / `CDS_MCP_DOWNLOAD_TIMEOUT` are read at **module import** (top-level), while `CDS_MCP_MAX_RESULTS` is validated lazily inside `search_docs`. A bad `MAX_RESULTS` won't crash startup — it blows up the first search call.
- **onnxruntime-node ships a 272 MB CUDA provider** (`libonnxruntime_providers_cuda.so`) even on machines without a GPU. For CPU-only demos: delete `providers_cuda.so` / `providers_tensorrt.so` after install, keep `libonnxruntime.so.1` + the binding.
- `hybridSearch` uses `node:sqlite` FTS5 when compiled in (Node 24: yes), with a pure-JS BM25 fallback otherwise.
- The default embedding model is `BAAI/bge-small-en-v1.5` (384-dim) since 0.0.8 — cached after first download.

## Versions pinned

- `@cap-js/mcp-server` 0.1.0 (depends on `@cap-js/ai` `^1.3.0`, `onnxruntime-node` `^1.30.0`)
- `@cap-js/ai` 1.3.0 (no runtime deps; peer `@sap/cds >= 9`)
