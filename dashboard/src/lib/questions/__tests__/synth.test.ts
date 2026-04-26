import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function llmResponse(text: string) {
  return new Response(JSON.stringify({
    model: 'anthropic/claude-sonnet-4.6',
    choices: [{ message: { content: text } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = 'test-or-key';
  delete process.env.ANTHROPIC_API_KEY;
});

describe('synthesize', () => {
  it('sends a system prompt via chat completions', async () => {
    mockFetch.mockResolvedValueOnce(
      llmResponse('You spent $1,000 over the last 7 days.'),
    );
    const { synthesize } = await import('../synth');
    const result = await synthesize({
      question_id: 'spend',
      period: '7d',
      client_id: 'acme',
      generated_at: '2026-04-25T12:00:00Z',
      available: true,
      facts: { total_spend: 1000 },
    });

    expect(result.answer).toContain('$1,000');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('openrouter.ai');
    const body = JSON.parse(opts.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('questions-first answer engine');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('"total_spend": 1000');
  });

  it('handles unavailable bundles by passing the reason through to the prompt', async () => {
    mockFetch.mockResolvedValueOnce(
      llmResponse('Keyword data is not yet wired in the warehouse.'),
    );
    const { synthesize } = await import('../synth');
    const result = await synthesize({
      question_id: 'best_keywords',
      period: '7d',
      client_id: 'acme',
      generated_at: '2026-04-25T12:00:00Z',
      available: false,
      not_available_reason: 'Keyword-entity rows are not yet ingested.',
    });
    expect(result.answer).toContain('not yet wired');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('not_available_reason');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('embeds every registry id so the cached prefix knows the full schema', async () => {
    const { SYSTEM_PROMPT } = await import('../synth');
    for (const id of [
      'spend',
      'revenue',
      'best_keywords',
      'best_ads',
      'best_audiences',
      'best_creatives',
      'trend_vs_prior',
      'next_test',
      'best_lp_variant',
      'pacing',
    ]) {
      expect(SYSTEM_PROMPT).toContain(`${id}:`);
    }
  });

  it('includes all 5 answer tone templates', async () => {
    const { SYSTEM_PROMPT } = await import('../synth');
    for (const template of [
      'WHY-CHANGED',
      'WHAT-TO-DO',
      'CELEBRATE-WIN',
      'EXPLAIN-DIP',
      'CALL-TO-DECISION',
    ]) {
      expect(SYSTEM_PROMPT).toContain(template);
    }
  });
});
