# cap-ai-131-010-0999

> **Last updated: 2026-11-01** · covers the CAP AI stack releases of late Oct 2026

| Package | Version | Published on npm |
|---|---|---|
| [@cap-js/ai](https://www.npmjs.com/package/@cap-js/ai) | **1.3.0** | 2026-10-26 |
| [@cap-js/mcp-server](https://www.npmjs.com/package/@cap-js/mcp-server) | **0.1.0** | 2026-10-26 |
| [@cap-js/agents](https://www.npmjs.com/package/@cap-js/agents) | **0.9.10** | 2026-10-26 |
| [@cap-js/audit-logging](https://www.npmjs.com/package/@cap-js/audit-logging) | **1.3.0** | 2026-09-10 |
| [@sap/cds](https://www.npmjs.com/package/@sap/cds) | **10.2.2** | 2026-10-28 |
| [@sap/approuter](https://www.npmjs.com/package/@sap/approuter) | **23.4.0** | 2026-10-29 |

TypeScript only — the server tests are `.mts` and run with no build step (Node 24 type stripping, requires Node >= 24, see `engines`); the React client in `app/web` is `.ts`/`.tsx`, type-checked with `tsc` and built with Vite.

## The BTP-style web client (App Router + React)

`app/web` (React 19 + TypeScript + **UI5 Web Components for React**, SAP Horizon, built with Vite) is served by **@sap/approuter** from `app/router/resources/` and talks to the CAP backend **only** through the `srv-api` destination with CSRF protection. The build output is git-ignored; the sources live in `app/web/src`.

```bash
npm run web:install && npm run web:build   # once: builds the client into app/router/resources
npm run serve                              # CAP on :4004 (no auth locally: auth.kind = dummy)
cd app/router && npm i && npm run start:local   # approuter on :5100, XSUAA switched off
# open http://localhost:5100/              (Windows: `start`, macOS: `open`)
```

Client development with hot reload: `npm run serve` + `cd app/web && npm run dev` → http://localhost:5173 (Vite proxies `/agent/*` to CAP, the same contract as the approuter). Type check: `cd app/web && npm run typecheck` (also runs as part of `npm run build`). Client tests: `npm run web:test` (vitest: CSRF caching, 403 retry, error handling).

- `xs-app.json` is the **production** config: both routes use `authenticationType: xsuaa`; `/agent/*` → destination `srv-api` (with `csrfProtection`), everything else → static `resources/`.
- `local.cjs` (`npm run start:local`) reuses that same `xs-app.json` with `authenticationMethod: none` and an in-code `srv-api` destination → `http://localhost:4004`. There is no `default-env.json` in git. Plain `npm start` needs an XSUAA binding (BTP).
- With `authenticationMethod: none` the approuter does not enforce CSRF — the check is only real behind XSUAA.
- `mta.yaml` builds the client in `before-all` (`npm ci` + `npm run build` in `app/web`).
- Client layout: `src/a2aClient.ts` (framework-free A2A JSON-RPC + cached CSRF token, one retry on 403) · `src/useChat.ts` (hook: messages / busy / send) · `src/App.tsx` (UI) · `src/main.tsx` (ThemeProvider + assets).
- Not verified in a real browser in this environment (no browser tooling was available) — the build, tests and the approuter→CAP chain were verified by HTTP.

### Frontend best practices (what this client follows)

1. **Pin versions** — UI5 web components are pinned to a minor (`~2.28.1`); `@ui5/webcomponents-react` needs the matching `@ui5/webcomponents*` minor.
2. **Type the wire format** — the A2A response shape is an interface, `tsc --noEmit` gates the build.
3. **Keep the transport framework-free** — `a2aClient.ts` has no React imports and takes an injectable `fetchImpl`, so it is unit-testable and portable.
4. **State in a hook, UI in components** — `useChat` owns `messages` / `busy`; `App` only renders and handles input.
5. **Render untrusted text as text** — agent output goes through React text children (escaped). Never use `dangerouslySetInnerHTML` for it (XSS).
6. **Fetch hygiene** — check `res.ok`, handle the JSON-RPC `error`, cache the CSRF token and refresh only on 403.
7. **Accessibility** — `accessibleName` on the input and the icon-only button, Enter submits, busy state is visible and disables input.
8. **Auth belongs to the approuter** — the page never sees tokens; routes are `xsuaa` by default and only `local.cjs` relaxes it.
9. **Same origin, relative URLs** — `base: './'` and `/agent/*` keep the bundle deployable behind any approuter path; no CORS.
10. **Static build, no SSR** — output is plain files in `resources/`, so `xs-app.json` / `mta.yaml` need no changes for the client.
11. **Bundle size** — the main chunk is ~730 kB (gzip ~177 kB). If it matters, import only the components you use and enable code splitting.

## The agents part (A2A + web chat, no API key)

`@cap-js/agents` is a CAP plugin: annotate a service with `@agent` and it becomes an A2A-protocol agent with an auto-generated card, auto-generated tools and a bundled chat web UI.

```bash
npm run serve          # boots CAP on :4004 (downloads a ~87 MB embedding model on first boot)
# chat UI: http://localhost:4004/agents/notes/preview/
curl http://localhost:4004/agents/notes/.well-known/agent-card.json
```

- `srv/notes-agent.cds` — the `@agent` service (entity + action → agent skills/tools)
- `cap.yaml` — `requires.llm.kind: llm-mock` — the built-in mock provider, zero API keys (locally only; the `[production]` profile switches to `aicore`, `xsuaa` and `hana`). The mock even **auto-calls the generated `query` tool** and returns real query output.
- A2A endpoint: `POST /agents/notes` with JSON-RPC `message/send` (A2A 0.3.0) — exercised live in `test/agents-web.test.mts`

### Sub-agents and MCP (auto-wiring)

`NotesAgent` is never told about other agents. With the plugin default `agents.connect: auto`, on the first request it connects every other service in the model (and every `cds.requires` entry with `kind: agent|mcp`):

| Annotation on the other service | Becomes, for the calling agent |
|---|---|
| `@agent` | a sub-agent tool "Delegate to …" (A2A; in-process if there is no `credentials`) |
| `@mcp` | MCP tools (local: `describe` / `query` / `call`; remote: `tools/list` per request) |

- `srv/notes-subagents.cds` — `ReviewAgent` (`@agent`, counts done notes) and `NotesStats` (`@mcp`, read-only notes + `totalCount`); handlers in `srv/notes-subagents.ts`.
- Any `@agent` service is "main" for the requests it receives; a sub-agent that must not call back sets `@agent.connect: 'none'` (else `ReviewAgent` ↔ `NotesAgent` would delegate in a loop). Other values: `'mcp'`, `'agent'`, or a list of service names.
- Check: `CDS_LOG_LEVELS='{"agents":"debug","mcp":"debug"}' npm run serve`, send any chat message → log shows `Connecting to subagent ReviewAgent` and `NotesStats – adding generic 'query' …`. Real delegation needs a real model (`--profile glm`); `llm-mock` only calls `query`.

## What's demoed from the other releases

| Release feature | Test |
|---|---|
| **Fail-fast env validation** (mcp-server 0.1.0): every `CDS_MCP_*` var checked by `lib/utils.js` — timeouts at import time, `CDS_MCP_MAX_RESULTS` per search call | `test/config-validation.test.mts` |
| **Runtime-aware hybrid search** (mcp-server 0.1.0): `hybridSearch(..., { runtime })` drops chunks labelled with the other runtime before cosine + BM25 (FTS5) + weighted RRF | `test/runtime-filter.test.mts` |
| **`installModel` public entrypoint** (ai 1.3.0): `import { installModel } from '@cap-js/ai/models.js'` — programmatic model provisioning without CAP plugin hooks | `test/ai-api.test.mts` |
| **Live model-download progress + stall-based timeouts** (ai 1.3.0) — visible in the boot log on first `npm run serve` | manual |
| **Audit logging with zero code** (`@cap-js/audit-logging` 1.3.0 + agents): installing the package is enough — the plugin emits `SecurityEvent`s (`AgentTaskStarted`, `AgentTaskCompleted` with `toolCalls`, …). Dev: printed to the console as `[audit-log] - SecurityEvent: {…}`; production: SAP Audit Log Service via the outbox (needs an `auditlog` resource in `mta.yaml`) | `test/agents-audit.test.mts` |
| **Tool calls streamed as A2A events** (agents 0.9.8, opt-in): `message/stream` with `metadata["tool-status-update"]: true` sends every tool call (name, arguments, result) as an `artifact-update` SSE event; the chat preview shows them too | `test/agents-audit.test.mts` |
| **TypeScript service implementations out of the box** (cds 10.2.0, Node 24+): `srv/notes-agent.ts` is picked up next to `notes-agent.cds` — no build, no `ts-node`; log line `impl: 'srv\notes-agent.ts'` | `test/notes-actions.test.mts` |
| **Agents section on the index page** (cds 10.2.0): `http://localhost:4004/` lists every `@agent` service with *Chat Preview* and *Agent Card* links | manual |
| **`cap.yaml` instead of `.cdsrc.json`/`package.json#cds`** (cds 10.2.0, opt-in `cds.features.cap_yaml`) — the whole config incl. profiles lives in `cap.yaml` | every test |
| **OpenAI-compatible provider** (agents 0.9.8): `llm.kind: openai` + `baseURL` — the `glm` profile runs the agent on GLM (Z.ai) with the key from `.env` | manual: `cds serve --profile glm` |
| **Initial data only for dev** (`[development]` loads `test/data`, production does not): `test/data/demo-Notes.csv` seeds five notes locally and never reaches HANA | `test/notes-actions.test.mts` |

### What the last update brought (`npm update`, 2026-11-01)

| Package | From → to | Change | Relevant here? |
|---|---|---|---|
| `@cap-js/agents` | 0.9.9 → 0.9.10 | Reverted the new AI Core content-filter API (not live on all BTP landscapes) | only for `aicore` in production |
| `@sap/cds` | 10.2.1 → 10.2.2 | Index page no longer builds `//app` links; `TimeoutOverflowWarning` fixed for retention > 24.8 days (`cds.env.agents.retention = '31d'`); config JSON schema fixes; translated `sap-messages` | index page + long agent retention |
| `@sap/approuter` | 23.3.0 → 23.4.0 | WebSocket ping/pong; literal `%` in paths no longer blocked as traversal; `Authorization: Bearer` for IAS app2app (`APP2APP_AUTHORIZATION_HANDLING`); Redis fallback to in-memory state; `deepmerge` dependency removed (CVE-2026-93753) | security fix, nothing to configure |
| `@cap-js/audit-logging` | new, 1.3.0 | Dropped CDS 8 support (needs `@sap/cds >= 9`) | newly added, see table above |

The UI5/React packages were already at their latest versions (`@ui5/webcomponents-base`/`-icons` in the lockfile are newer than the `latest` dist-tag, so they stay).

## Run

```bash
npm install
npm test          # 15 tests (Node >= 24); runtime-filter test downloads BAAI/bge-small-en-v1.5 (~30 MB) on first use
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
- `@cap-js/agents` 0.9.10, `@cap-js/audit-logging` 1.3.0, `@sap/cds` 10.2.2
- `@ui5/webcomponents-react` 2.28.2 (+ `@ui5/webcomponents` ~2.28.1), React 19.3, Vite 8, `@sap/approuter` ^23.4.0

## More pitfalls

- **Agent services are A2A-only by default**: `/agents/notes/Notes` returns 404 — entity access happens through generated agent tools, not REST. Add `@(odata: true)` to the service if you also want OData.
- **No `cds` CLI without @sap/cds-dk** — @sap/cds ships only the `cds-serve` bin; use `npm run serve`. (`mta.yaml` pulls cds-dk on the fly via `npx -p @sap/cds-dk`.)
- **Windows**: `node_modules/.bin/*` are `.cmd` shims — tests start the server through `node_modules/@sap/cds/bin/serve.js` instead.
- The @cap-js/ai plugin boots with the server and blocks startup until its embedding model is downloaded/validated (~87 MB on first boot — that's the 1.3.0 progress log in action).
