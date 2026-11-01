import { useCallback, useMemo, useState } from 'react'
import { createA2AClient } from './a2aClient.ts'

export interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

const WELCOME: ChatMessage = {
  role: 'agent',
  text: 'Hi! I am your notes assistant. Ask me to **count**, **rename** or **complete** your notes.'
}

export function useChat() {
  const client = useMemo(() => createA2AClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [busy, setBusy] = useState(false)

  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setMessages(m => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const answer = await client.send(text)
      setMessages(m => [...m, { role: 'agent', text: answer }])
    } catch (err) {
      setMessages(m => [...m, { role: 'agent', text: `⚠️ ${(err as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }, [client, busy])

  return { messages, busy, send }
}
