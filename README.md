# cap-ai-mcp-whats-new

Demo project for the CAP AI stack releases of late Oct 2026: **@cap-js/ai 1.3.0**, **@cap-js/mcp-server 0.1.0** and **@cap-js/agents 0.9.9**. TypeScript only, zero build step — Node 24 type stripping loads `.mts` natively.

## The BTP-style web client (App Router)

`app/router` + `app/router/resources/index.html` — the production pattern from the official bookshop sample: a static web client served by **@sap/approuter**, talking to the CAP backend **only** through the `srv-api` destination with CSRF protection.

```bash
npm run serve &                      # CAP on :4004
cd app/router && npm i && npm start  # approuter on :5100 (local: default-env.json → :4004)
open http://localhost:5100/          # the chat client, proxied to the agent
```

- `xs-app.json`: `/agent/*` → destination `srv-api` (csrfProtection), everything else → static `resources/`
- The page does the BTP CSRF dance: `GET X-CSRF-Token: fetch`, then sends the token on every `message/send`
- On BTP add `authenticationType: OAuth2` + XSUAA binding (mta.yaml included, resources: xsuaa / hana / aicore)

## The agents part (A2A + web chat, no API key)

`@cap-js/agents` is a CAP plugin: annotate a service with `@agent` and it becomes an A2A-protocol agent with an auto-generated card, auto-generated tools and a bundled chat web UI.

```bash
npm run serve          # boots CAP on :4004 (downloads a ~87 MB embedding model on first boot)
open http://localhost:4004/agents/notes/preview/     # chat UI
curl http://localhost:4004/agents/notes/.well-known/agent-card.json
```

- `srv/notes-agent.cds` — the `@agent` service (entity + action → agent skills/tools)
- `cap.yaml` — `requires.llm.kind: llm-mock` — the built-in mock provider, zero API keys. The mock even **auto-calls the generated `query` tool** and returns real query output.
- A2A endpoint: `POST /agents/notes` with JSON-RPC `message/send` (A2A 0.3.0) — exercised live in `test/agents-web.test.mts`

## What's demoed from the other releases

| Release feature | Test |
|---|---|
| **Fail-fast env validation** (mcp-server 0.1.0): every `CDS_MCP_*` var checked by `lib/utils.js` — timeouts at import time, `CDS_MCP_MAX_RESULTS` per search call | `test/config-validation.test.mts` |
| **Runtime-aware hybrid search** (mcp-server 0.1.0): `hybridSearch(..., { runtime })` drops chunks labelled with the other runtime before cosine + BM25 (FTS5) + weighted RRF | `test/runtime-filter.test.mts` |
| **`installModel` public entrypoint** (ai 1.3.0): `import { installModel } from '@cap-js/ai/models.js'` — programmatic model provisioning without CAP plugin hooks | `test/ai-api.test.mts` |
| **Live model-download progress + stall-based timeouts** (ai 1.3.0) — visible in the boot log on first `npm run serve` | manual |

## Run

```bash
npm install
npm test          # 9 tests; runtime-filter test downloads BAAI/bge-small-en-v1.5 (~30 MB) on first use
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
- **Agent services are A2A-only by default**: `/agents/notes/Notes` returns 404 — entity access happens through generated agent tools, not REST. Add `@(odata: true)` to the service if you also want OData.
- **No `cds` CLI without @sap/cds-dk** — @sap/cds ships only the `cds-serve` bin; use `npm run serve`.
- The @cap-js/ai plugin boots with the server and blocks startup until its embedding model is downloaded/validated (~87 MB on first boot — that's the 1.3.0 progress log in action).
