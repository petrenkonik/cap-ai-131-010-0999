import { useEffect, useRef, useState } from 'react'
import { BusyIndicator, Bar, Button, FlexBox, Input, Page, Text, Title } from '@ui5/webcomponents-react'
import '@ui5/webcomponents-icons/dist/paper-plane.js'
import Markdown from 'react-markdown'
import { useChat } from './useChat.ts'

export default function App() {
  const { messages, busy, send } = useChat()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // keep the newest message in view
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages])

  const submit = () => {
    if (!draft.trim() || busy) return
    void send(draft)
    setDraft('')
  }

  return (
    <Page
      style={{ height: '100%' }}
      header={<Bar startContent={<Title level="H5">Notes Agent — React · A2A 0.3.0 · via App Router</Title>} />}
      footer={
        <div className="composer">
          <Input
            className="composer-input"
            value={draft}
            placeholder="Ask the agent…"
            accessibleName="Message to the agent"
            disabled={busy}
            onInput={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
          <Button design="Emphasized" icon="paper-plane" tooltip="Send" accessibleName="Send"
                  disabled={busy || !draft.trim()} onClick={submit} />
        </div>
      }
    >
      <FlexBox direction="Column" style={{ gap: '.5rem', padding: '1rem' }}>
        {/* Agent output is rendered as Markdown via react-markdown: it builds React elements and
            ignores raw HTML by default, so the reply is never injected as HTML. */}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'agent' ? <Markdown>{m.text}</Markdown> : <Text>{m.text}</Text>}
          </div>
        ))}
        {busy && <BusyIndicator active size="S" />}
        <div ref={endRef} />
      </FlexBox>
    </Page>
  )
}
