import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const freePort = () => new Promise<number>((resolve, reject) => {
  const s = net.createServer()
  s.once('error', reject)
  s.listen(0, () => {
    const { port } = s.address() as net.AddressInfo
    s.close(() => resolve(port))
  })
})

async function waitFor<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  const t0 = Date.now()
  for (;;) {
    try { return await fn() } catch (err) {
      if (Date.now() - t0 > timeoutMs) throw err
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

/**
 * NotesAgent is never told about ReviewAgent / NotesStats: with the plugin default
 * `agents.connect: "auto"` it picks up every other @agent / @mcp service when its
 * tools are built (on the first request). The debug log of that step is the proof.
 */
test('NotesAgent auto-connects the @agent sub-agent and the @mcp service', { timeout: 90_000 }, async () => {
  const PORT = await freePort()
  const base = `http://localhost:${PORT}/agents/notes`
  // log to a file (not pipes): open pipes crash libuv on exit under --test-force-exit on Windows
  const logFile = path.join(os.tmpdir(), `notes-subagents-${PORT}.log`)
  const fd = fs.openSync(logFile, 'w')
  const child = spawn(process.execPath, [path.join(root, 'node_modules/@sap/cds/bin/serve.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), CDS_LOG_LEVELS: JSON.stringify({ agents: 'debug', mcp: 'debug' }) },
    stdio: ['ignore', fd, fd],
  })
  const readLog = () => fs.readFileSync(logFile, 'utf8')
  let exited: number | undefined
  child.on('exit', code => (exited = code ?? -1))

  await waitFor(async () => {
    if (exited !== undefined) throw new Error(`server exited (${exited}):\n${readLog()}`)
    const r = await fetch(`${base}/.well-known/agent-card.json`)
    await r.arrayBuffer() // consume the body, else undici leaves a handle open at exit
    if (!r.ok) throw new Error(`card not ready: ${r.status}`)
  }, 60_000)

  const rpc = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'message/send',
      params: { message: { role: 'user', kind: 'message', messageId: `m-${Date.now()}`, parts: [{ kind: 'text', text: 'how many notes are open?' }] } },
    }),
  })
  assert.equal(rpc.status, 200)
  await rpc.json()

  const log = readLog()
  child.kill()
  await new Promise(r => child.once('exit', r))
  fs.closeSync(fd)
  fs.rmSync(logFile, { force: true })
  assert.match(log, /Connecting to subagent ReviewAgent/, `no sub-agent connection in log:\n${log}`)
  assert.match(log, /NotesStats . adding generic 'query'/, `no MCP tools in log:\n${log}`)
})
