/** The slice of the A2A 0.3.0 `message/send` response this client reads. */
interface A2AResponse {
  result?: { status?: { message?: { parts?: Array<{ text?: string }> } } }
  error?: { message?: string }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface A2AClient {
  /** Sends one user message, resolves with the agent's reply text. */
  send(text: string): Promise<string>
}

/**
 * Minimal A2A (0.3.0) JSON-RPC client. Talks to CAP ONLY through the App Router
 * (destination srv-api); on BTP the same route is XSUAA-protected.
 * The CSRF token is fetched once, cached, and refreshed only when the server rejects it.
 */
export function createA2AClient({
  endpoint = '/agent/agents/notes',
  fetchImpl = (input, init) => fetch(input, init)
}: { endpoint?: string; fetchImpl?: FetchLike } = {}): A2AClient {
  const contextId = crypto.randomUUID()
  let csrfToken = ''

  async function fetchCsrf(): Promise<void> {
    const res = await fetchImpl(endpoint, { headers: { 'X-CSRF-Token': 'fetch' } })
    csrfToken = res.headers.get('x-csrf-token') ?? ''
  }

  const post = (text: string) =>
    fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'message/send',
        params: {
          message: {
            role: 'user',
            kind: 'message',
            messageId: crypto.randomUUID(),
            contextId,
            parts: [{ kind: 'text', text }]
          }
        }
      })
    })

  return {
    async send(text) {
      if (!csrfToken) await fetchCsrf()
      let res = await post(text)
      if (res.status === 403) {
        // token expired / session changed → refresh once and retry
        await fetchCsrf()
        res = await post(text)
      }
      if (!res.ok) throw new Error(`Agent request failed: HTTP ${res.status}`)

      const body = (await res.json()) as A2AResponse
      if (body.error) throw new Error(body.error.message ?? 'Agent returned an error')
      const parts = body.result?.status?.message?.parts ?? []
      return parts.map(p => p.text ?? '').join('\n') || '(empty response)'
    }
  }
}
