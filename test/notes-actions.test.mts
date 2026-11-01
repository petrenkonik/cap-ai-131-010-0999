import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cds from '@sap/cds'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OPEN = '11111111-1111-4111-8111-111111111101' // "Buy milk" (test/data/demo-Notes.csv)
const DONE = '11111111-1111-4111-8111-111111111104'

/**
 * Calls the service handlers in-process (no HTTP, no LLM): the service only
 * speaks the agent protocol, so this is the direct way to test the actions.
 */
let srv: cds.ApplicationService
let server: { close(): void }

before(async () => {
  process.chdir(root)
  // full bootstrap (plugins, in-memory sqlite + test/data), on a random free port
  server = await cds.server({ port: 0, in_memory: true }) as unknown as { close(): void }
  srv = cds.services.NotesAgent as cds.ApplicationService
})

after(() => server?.close())

// the service requires an authenticated user
const as = <T,>(fn: (tx: cds.ApplicationService) => Promise<T>) =>
  srv.tx({ user: new cds.User({ id: 'alice' }) }, fn as never) as Promise<T>

test('openCount() counts only notes that are not done', async () => {
  assert.equal(await as(tx => tx.send('openCount')), 3)
})

test('complete() marks a note done and lowers openCount()', async () => {
  assert.equal(await as(tx => tx.send('complete', { ID: OPEN })), true)
  assert.equal(await as(tx => tx.send('openCount')), 2)
})

test('rename() changes the title and trims it', async () => {
  assert.equal(await as(tx => tx.send('rename', { ID: DONE, title: '  Flights booked  ' })), true)
  const note = await as(tx => tx.run(cds.ql.SELECT.one.from('NotesAgent.Notes').where({ ID: DONE })))
  assert.equal(note.title, 'Flights booked')
})

test('rename() rejects an empty title and an unknown note', async () => {
  await assert.rejects(as(tx => tx.send('rename', { ID: DONE, title: '   ' })), { code: 400 })
  await assert.rejects(as(tx => tx.send('rename', { ID: '99999999-9999-4999-8999-999999999999', title: 'x' })), { code: 404 })
})
