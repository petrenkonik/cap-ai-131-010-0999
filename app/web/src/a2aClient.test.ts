import { test, expect, vi } from 'vitest'
import { createA2AClient } from './a2aClient.ts'

const reply = (text: string) => ({ result: { status: { message: { parts: [{ text }] } } } })
const res = (status: number, body: unknown, token?: string) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(token ? { 'x-csrf-token': token } : {}),
    json: async () => body
  }) as Response

const csrfHeader = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>)['X-CSRF-Token']

test('fetches the CSRF token once and reuses it', async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(res(200, {}, 'tok1'))
    .mockResolvedValue(res(200, reply('hi')))
  const c = createA2AClient({ fetchImpl: f })
  expect(await c.send('a')).toBe('hi')
  await c.send('b')
  expect(f).toHaveBeenCalledTimes(3) // 1 fetch-token + 2 posts
  expect(csrfHeader(f.mock.calls[1])).toBe('tok1')
})

test('refreshes the token and retries once on 403', async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(res(200, {}, 'old'))
    .mockResolvedValueOnce(res(403, {}))
    .mockResolvedValueOnce(res(200, {}, 'new'))
    .mockResolvedValueOnce(res(200, reply('ok')))
  const c = createA2AClient({ fetchImpl: f })
  expect(await c.send('x')).toBe('ok')
  expect(csrfHeader(f.mock.calls[3])).toBe('new')
})

test('throws on HTTP errors and on JSON-RPC errors', async () => {
  const f1 = vi.fn().mockResolvedValueOnce(res(200, {}, 't')).mockResolvedValueOnce(res(500, {}))
  await expect(createA2AClient({ fetchImpl: f1 }).send('x')).rejects.toThrow('HTTP 500')
  const f2 = vi.fn().mockResolvedValueOnce(res(200, {}, 't')).mockResolvedValueOnce(res(200, { error: { message: 'boom' } }))
  await expect(createA2AClient({ fetchImpl: f2 }).send('x')).rejects.toThrow('boom')
})
