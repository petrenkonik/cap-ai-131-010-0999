import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * NEW in @cap-js/mcp-server 0.1.0: hybridSearch() accepts a `runtime` option.
 * Chunks labelled with the OTHER runtime are dropped before semantic + BM25
 * ranking; unlabelled chunks always stay. `CDS_MCP_GENERIC_EMBEDDINGS=true`
 * (or runtime: undefined) restores the old all-runtimes behaviour.
 *
 * This test needs a real embedding for the query (default model
 * BAAI/bge-small-en-v1.5, downloaded on first use), so it is skipped when the
 * model cannot be loaded (e.g. offline CI).
 */

const chunks = [
  { content: 'node: serve OData with cds serve', embeddings: rand(384), meta: { label: 'nodejs' } },
  { content: 'java: run the CAP Java runtime', embeddings: rand(384), meta: { label: 'java' } },
  { content: 'unlabelled: CAP is a framework', embeddings: rand(384), meta: {} },
]

function rand(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1)
}

test('runtime-aware filtering drops the other runtime, keeps unlabelled', async t => {
  let hybridSearch: (q: string, chunks: unknown[], opts?: unknown) => Promise<Array<{ text: string }>>
  try {
    ;({ hybridSearch } = await import('@cap-js/mcp-server/lib/embeddings.js'))
    // warm the query embedding path (downloads the model on first use)
    const { getEmbeddings } = await import('@cap-js/mcp-server/lib/embeddings.js')
    await getEmbeddings('warmup')
  } catch (err) {
    t.skip(`model unavailable (${(err as Error).message.slice(0, 80)})`)
    return
  }

  const filtered = await hybridSearch('serve odata', chunks, { runtime: 'nodejs' })
  const texts = filtered.map(c => c.content)
  assert.ok(texts.some(x => x.includes('node:')), 'matching runtime stays')
  assert.ok(texts.some(x => x.includes('unlabelled:')), 'unlabelled always stays')
  assert.ok(!texts.some(x => x.includes('java:')), 'other runtime is dropped')

  // runtime: undefined -> old behaviour, everything is ranked
  const generic = await hybridSearch('serve odata', chunks)
  assert.equal(generic.length, chunks.length)
})
