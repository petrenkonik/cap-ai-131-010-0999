import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

async function waitFor(fn: () => Promise<boolean> | boolean, timeoutMs: number, everyMs = 500) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try { if (await fn()) return } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, everyMs))
  }
  throw new Error('timeout')
}

/**
 * @cap-js/audit-logging + @cap-js/agents: with the audit package installed the
 * plugin emits `SecurityEvent`s (dev: to the console, prod: SAP Audit Log Service
 * via the outbox) — no code, no config. The tool-status-update opt-in
 * (agents 0.9.8) streams each tool call as an A2A `artifact-update` event.
 */
test('agent run emits audit events and streams tool-status artifacts', { timeout: 120_000 }, async t => {
  const PORT = await freePort()
  const base = `http://localhost:${PORT}/agents/notes`
  const child = spawn(process.execPath, [path.join(root, 'node_modules/@sap/cds/bin/serve.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout?.on('data', d => (log += d))
  child.stderr?.on('data', d => (log += d))
  t.after(() => child.kill())

  await waitFor(async () => (await fetch(`${base}/.well-known/agent-card.json`)).ok, 90_000)

  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'message/stream',
      params: {
        message: {
          role: 'user',
          kind: 'message',
          messageId: `m-${Date.now()}`,
          parts: [{ kind: 'text', text: 'show me my notes' }],
          metadata: { 'tool-status-update': true },
        },
      },
    }),
  })
  assert.equal(res.status, 200)
  const stream = await res.text()

  // agents 0.9.8: tool calls are visible to any SSE consumer
  assert.match(stream, /artifact-update/, 'tool call must be streamed as an artifact-update event')
  assert.match(stream, /"state":"completed"/)

  // audit-logging: a SecurityEvent for task start and end; the end event lists the tools used
  await waitFor(() => /AgentTaskCompleted/.test(log), 10_000)
  for (const event of ['AgentTaskStarted', 'AgentTaskCompleted']) {
    assert.match(log, new RegExp(`event: '${event}'`), `audit event ${event} missing`)
  }
  assert.match(log, /toolCalls: \[ 'query' \]/, 'completed event must record the tool call')
})
