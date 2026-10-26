import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mcpRoot = path.join(root, 'node_modules', '@cap-js', 'mcp-server')

/**
 * NEW in @cap-js/mcp-server 0.1.0: every CDS_MCP_* env var is validated by
 * lib/utils.js helpers that run at module import time — a bad value kills the
 * process at startup with a clear message instead of misbehaving later.
 */

test('validators accept valid values and defaults', async () => {
  const { configuredPositiveInteger, configuredBoolean } = await import(
    '@cap-js/mcp-server/lib/utils.js'
  )
  // unset -> default comes back
  assert.equal(configuredPositiveInteger('X_DEMO_ABSENT', 7, { maximum: 100 }), 7)
  assert.equal(configuredBoolean('X_DEMO_ABSENT_BOOL', false), false)

  process.env.X_DEMO_N = '42'
  assert.equal(configuredPositiveInteger('X_DEMO_N', 1, { maximum: 100 }), 42)
  process.env.X_DEMO_B = 'true'
  assert.equal(configuredBoolean('X_DEMO_B'), true)
  delete process.env.X_DEMO_N
  delete process.env.X_DEMO_B
})

test('validators reject garbage with a clear error', async () => {
  const { configuredPositiveInteger, configuredBoolean } = await import(
    '@cap-js/mcp-server/lib/utils.js'
  )
  process.env.X_DEMO_BAD = 'abc'
  assert.throws(() => configuredPositiveInteger('X_DEMO_BAD', 10), /positive integer/)
  process.env.X_DEMO_BAD = 'trueish'
  assert.throws(() => configuredBoolean('X_DEMO_BAD'), /must be true or false/)
  delete process.env.X_DEMO_BAD
})

test('importing the search module with CDS_MCP_MANIFEST_TIMEOUT=abc fails fast', () => {
  // manifest/bundle timeouts are validated at module import time (top level)
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', "import('@cap-js/mcp-server/lib/searchMarkdownDocs.js')"],
    { cwd: mcpRoot, env: { ...process.env, CDS_MCP_MANIFEST_TIMEOUT: 'abc' }, encoding: 'utf8' }
  )
  assert.notEqual(r.status, 0, 'process must exit non-zero on invalid env')
  assert.match(r.stderr, /positive integer/)
})

test('same import with a valid env loads cleanly (exit 0)', () => {
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', "import('@cap-js/mcp-server/lib/searchMarkdownDocs.js')"],
    { cwd: mcpRoot, env: { ...process.env, CDS_MCP_MAX_RESULTS: '5' }, encoding: 'utf8' }
  )
  assert.equal(r.status, 0, r.stderr)
})
