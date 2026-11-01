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

function waitFor<T>(fn: () => Promise<T>, timeoutMs: number, everyMs = 1000): Promise<T> {
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        resolve(await fn())
      } catch (err) {
        if (Date.now() - t0 > timeoutMs) reject(err)
        else setTimeout(tick, everyMs)
      }
    }
    tick()
  })
}

let child: ReturnType<typeof spawn> | undefined

test('agents plugin: A2A card, web chat preview and a full mock-LLM roundtrip', { timeout: 90_000 }, async t => {
  const PORT = await freePort()
  const base = `http://localhost:${PORT}/agents/notes`
  // run the cds-serve entry via node directly (node_modules/.bin/* are .cmd shims on Windows)
  child = spawn(process.execPath, [path.join(root, 'node_modules/@sap/cds/bin/serve.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr?.on('data', d => (stderr += d))
  let exited: number | null | undefined
  child.on('exit', code => (exited = code ?? -1))
  t.after(() => child?.kill())

  // 1. A2A agent card (NEW in @cap-js/agents 0.9.9: compiled from @agent CDS annotations)
  const card = await waitFor(async () => {
    if (exited !== undefined) throw new Error(`server exited (${exited}):
${stderr}`)
    const r = await fetch(`${base}/.well-known/agent-card.json`)
    if (!r.ok) throw new Error(`card not ready: ${r.status}`)
    return r.json() as Promise<Record<string, unknown>>
  }, 60_000).catch(err => {
    throw new Error(`${(err as Error).message}
--- server stderr ---
${stderr}`)
  })
  assert.equal(card.protocolVersion, '0.3.0')
  assert.match(String(card.name), /NotesAgent/)

  // 2. Web chat preview UI is served
  const preview = await fetch(`${base}/preview/`)
  assert.equal(preview.status, 200)
  const html = await preview.text()
  assert.match(html, /chat|agent/i)

  // 3. Full A2A roundtrip on the llm-mock provider (no API key): the mock model
  //    even auto-calls the generated `query` tool and returns real tool output.
  const rpc = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          kind: 'message',
          messageId: `m-${Date.now()}`,
          contextId: 'demo-context',
          parts: [{ kind: 'text', text: 'show me my notes' }],
        },
      },
    }),
  })
  assert.equal(rpc.status, 200)
  const body = (await rpc.json()) as {
    result?: { status?: { state?: string; message?: { parts?: Array<{ text?: string }> } }; kind?: string }
  }
  assert.equal(body.result?.kind, 'task')
  assert.equal(body.result?.status?.state, 'completed')
  const reply = (body.result?.status?.message?.parts ?? []).map(p => p.text ?? '').join('')
  assert.ok(reply.trim().length > 0, 'agent must answer with non-empty text')

  child?.kill()
})
