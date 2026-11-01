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

test('installModel() validates its configuration instead of crashing', async () => {
  // Called without a config it must reject with a *validation* error (not a
  // network/IO failure) — proves the entrypoint is wired and checks its input.
  const { installModel } = await import('@cap-js/ai/models.js')
  await assert.rejects(
    () => (installModel as (r?: unknown) => Promise<unknown>)(),
    /embedding\.repository must be a safe Hugging Face repository ID/
  )
})
