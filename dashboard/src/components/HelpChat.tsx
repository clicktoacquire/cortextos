'use client';

import { useState, useRef, useEffect } from 'react';
import { IconMessageCircle, IconX, IconSend } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const answer = data.answer ?? data.error ?? 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Failed to reach the training agent.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={[
          'fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center',
          'rounded-full bg-foreground text-background shadow-lg',
          'hover:opacity-90 transition-opacity',
          open ? 'hidden' : '',
        ].join(' ')}
        aria-label="Ask the training agent"
      >
        <IconMessageCircle size={20} />
      </button>

      {/* Side panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[520px] w-[380px] flex-col rounded-tl-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Training Agent</p>
              <p className="text-xs text-muted-foreground">Ask about the CTA Platform</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <IconX size={14} />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center pt-8">
                Ask anything about the dashboard, clients, or ad workflows.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={[
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'ml-auto bg-foreground text-background'
                    : 'bg-muted text-foreground',
                ].join(' ')}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground animate-pulse">
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a question… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <IconSend size={14} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
