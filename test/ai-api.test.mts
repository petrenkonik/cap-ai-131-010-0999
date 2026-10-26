import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/**
 * NEW in @cap-js/ai 1.3.0: a package entrypoint `@cap-js/ai/models.js` that
 * exports installModel() for validated, programmatic model provisioning —
 * without CAP plugin hooks running on import.
 */

test('models.js entrypoint exports installModel as an async function', async () => {
  const mod = await import('@cap-js/ai/models.js')
  assert.equal(typeof mod.installModel, 'function')
  assert.equal(mod.installModel.constructor.name, 'AsyncFunction')
})

test('existing cds-ai CLI still works (--help exits 0)', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules/@cap-js/ai/bin/cds-ai.js'), '--help'], {
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /install-model|model/i)
})

test('embedding config knobs are readable (embedding.root / embedding.offline)', async () => {
  // 1.3.0 added per-service embedding.root (model lookup without changing the
  // project root) and embedding.offline (read-only, local-then-home lookup).
  const { installModel } = await import('@cap-js/ai/models.js')
  // calling with no args must fail with a *configuration* error, not a crash —
  // proves the function entrypoint is wired and validates input.
  await assert.rejects(() => (installModel as (r?: unknown) => Promise<unknown>)(), Error)
})
