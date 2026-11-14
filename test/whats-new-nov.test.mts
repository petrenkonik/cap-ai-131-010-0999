import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cds from '@sap/cds'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/**
 * What's-new demos for the CAP releases of Nov 4–12, 2026:
 *   1. @cap-js/agents 0.9.11     — AGENTS.md autodiscovery compiles the A2A card
 *                                  (replaces the dropped @agent.card annotation)
 *   2. @cap-js/db-service 3.2.0  — expand/EXISTS filters use LEFT OUTER JOINs,
 *                                  preserving rows for OR + null assoc paths
 *   3. @cap-js/hana 3.2.0        — vector embedding shorthand in CQL:
 *                                  cosine_similarity(embedding, 'query text')
 */
let server: { close(): void; address(): { port: number } }

before(async () => {
  process.chdir(root)
  server = (await cds.server({ port: 0, in_memory: true })) as never

  // seed the LEFT JOIN demo: Poetry's ONLY book (b2) has editor = NULL and title = 'bar'
  await cds.db.run(
    INSERT.into('demo.Genres').columns('ID', 'name').rows([
      ['11111111-2222-4222-8222-111111111101', 'Fiction'],
      ['11111111-2222-4222-8222-111111111102', 'Poetry'],
    ]),
  )
  await cds.db.run(
    INSERT.into('demo.Editors').columns('ID', 'name').rows([
      ['11111111-4444-4444-8444-111111111101', 'E1'],
    ]),
  )
  await cds.db.run(
    INSERT.into('demo.Books').columns('ID', 'title', 'genre_ID', 'editor_ID').rows([
      ['11111111-3333-4333-8333-111111111101', 'bar', '11111111-2222-4222-8222-111111111101', '11111111-4444-4444-8444-111111111101'], // Fiction, E1
      ['11111111-3333-4333-8333-111111111102', 'bar', '11111111-2222-4222-8222-111111111102', null], // Poetry, NO editor ← the regression case
      ['11111111-3333-4333-8333-111111111103', 'other', '11111111-2222-4222-8222-111111111101', null], // Fiction, no editor
    ]),
  )
})

after(() => server?.close())

test('agents 0.9.11: AGENTS.md frontmatter + skills/ compile into the A2A card', async () => {
  const port = server.address().port
  const res = await fetch(`http://localhost:${port}/agents/notes/.well-known/agent-card.json`)
  assert.equal(res.status, 200)
  const card = (await res.json()) as {
    name: string; description: string; version: string
    skills?: { id: string; name: string; description: string; tags: string[]; examples: string[] }[]
  }

  // frontmatter from srv/agents/notes/AGENTS.md overrides the annotation defaults
  assert.equal(card.version, '1.1.0')
  assert.match(card.description, /Keeps your notes in order/)

  // skills/ manifests are scanned and compiled with tags + examples
  const ids = (card.skills ?? []).map(s => s.id)
  assert.ok(ids.includes('mark-done'), `mark-done skill missing, got: ${ids}`)
  assert.ok(ids.includes('find-notes'), `find-notes skill missing, got: ${ids}`)
  const markDone = (card.skills ?? []).find(s => s.id === 'mark-done')!
  assert.deepEqual(markDone.tags, ['notes', 'actions'])
  assert.ok(markDone.examples.length >= 2)
})

test('db-service 3.2.0: LEFT OUTER JOIN in EXISTS preserves rows for OR over null assoc paths', async () => {
  // Poetry's only book has editor = NULL and title = 'bar'.
  // Pre-3.2.0 an INNER JOIN dropped that book -> Poetry never matched; now it does.
  const genres = await cds.db.run(
    SELECT.from('demo.Genres').columns('name')
      .where(`exists books[editor.name = 'E1' or title = 'bar']`),
  ) as { name: string }[]
  const names = genres.map(g => g.name)
  assert.ok(names.includes('Poetry'), `Poetry must match via the null-editor book, got: ${names}`)
  assert.ok(names.includes('Fiction'))

  // negative control: a pure path predicate still requires the path —
  // the left join must not fabricate matches when every branch is NULL
  const strict = await cds.db.run(
    SELECT.from('demo.Genres').columns('name')
      .where(`exists books[editor.name = 'E1']`),
  ) as { name: string }[]
  assert.deepEqual(strict.map(g => g.name), ['Fiction'])

  // and the generated SQL proves the mechanism
  const { sql } = (cds.db as unknown as { cqn2sql(q: object): { sql: string } })
    .cqn2sql(SELECT.from('demo.Genres').where(`exists books[editor.name = 'E1' or title = 'bar']`))
  assert.match(sql, /left\s+join/i)
})

test('hana 3.2.0: vector embedding shorthand — string auto-wrapped, model per @cds.embeddings.model', async t => {
  // Standalone SQL renderer — no HANA server needed: we only assert SQL generation.
  // Object.create skips the DatabaseService constructor (no env/connect probing);
  // cqn2sql only needs the linked model + the CQN2SQL class.
  const HANAService = (await import('@cap-js/hana')).default as unknown as {
    prototype: Record<string, unknown>; CQN2SQL: unknown
  }
  const svc = Object.create(HANAService.prototype) as unknown as {
    model: object; options: object; class: unknown; kind: string
    cqn2sql(q: object): { sql: string }
  }

  const model = cds.linked(cds.compile(`
    entity Docs {
      key ID : Integer;
      embedding : Vector;
      @cds.embeddings.model: 'embed-model'
      annotated : Vector;
    }
  `))
  svc.model = model
  svc.options = { model, credentials: {} }
  svc.class = HANAService
  svc.kind = 'hana'

  // per-element model config; anything else falls back to the default model
  ;(cds.env.requires as Record<string, unknown>)['embed-model'] = { model: 'MY.SPECIAL.MODEL' }

  // 1. plain string right-hand side is auto-wrapped into vector_embedding(text,'QUERY',model)
  const plain = svc.cqn2sql(
    SELECT.one.from(model.definitions.Docs)
      .columns({ func: 'cosine_similarity', args: [{ ref: ['embedding'] }, { val: 'moon landing' }], as: 'score' }),
  )
  assert.match(plain.sql, /cosine_similarity\("?\$?\w*"?\."?embedding"?,vector_embedding\(\?,'QUERY','SAP_GXY\.20250407'\)\)/)

  // 2. element annotated with @cds.embeddings.model selects its configured model
  const annotated = svc.cqn2sql(
    SELECT.one.from(model.definitions.Docs)
      .columns({ func: 'cosine_similarity', args: [{ ref: ['annotated'] }, { val: 'moon landing' }], as: 'score' }),
  )
  assert.match(annotated.sql, /vector_embedding\(\?,'QUERY','MY\.SPECIAL\.MODEL'\)/)

  // 3. explicit vector_embedding('text') shorthand renders the same way
  const explicit = svc.cqn2sql(
    SELECT.one.from(model.definitions.Docs)
      .columns({ func: 'vector_embedding', args: [{ val: 'moon landing' }], as: 'vec' }),
  )
  assert.match(explicit.sql, /vector_embedding\(\?,'QUERY','SAP_GXY\.20250407'\)/)
})
