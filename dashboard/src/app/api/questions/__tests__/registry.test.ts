import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('@google-cloud/bigquery', () => {
  return {
    BigQuery: class MockBigQuery {
      query = mockQuery;
    },
  };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function llmResponse(text: string, cacheCreated = 0, cacheRead = 0) {
  return new Response(JSON.stringify({
    model: 'anthropic/claude-sonnet-4.6',
    choices: [{ message: { content: text } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function makeGet(qs: string) {
  return new Request(`http://localhost:3000/api/questions${qs}`, {
    method: 'GET',
  }) as unknown as import('next/server').NextRequest;
}

function makePost(body: unknown) {
  return new Request('http://localhost:3000/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = 'test-or-key';
  delete process.env.ANTHROPIC_API_KEY;
});

describe('GET /api/questions (registry list)', () => {
  it('lists every confirmed question with availability metadata', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGet(''));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.questions)).toBe(true);
    expect(json.questions).toHaveLength(10);
    const ids = json.questions.map((q: { id: string }) => q.id);
    expect(ids).toContain('spend');
    expect(ids).toContain('revenue');
    expect(ids).toContain('pacing');
    const unavailable = json.questions.filter((q: { available: boolean }) => !q.available);
    expect(unavailable.length).toBeGreaterThan(0);
    for (const q of unavailable) {
      expect(typeof q.not_available_reason).toBe('string');
    }
  });
});

describe('GET /api/questions (single answer)', () => {
  it('returns 400 when client_id is missing', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGet('?question_id=spend'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('client_id');
  });

  it('returns 400 when question_id is unknown', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGet('?client_id=acme&question_id=bogus'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unknown question_id');
  });

  it('returns 400 when period is invalid', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGet('?client_id=acme&question_id=spend&period=2y'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('period');
  });

  it('answers a spend question end-to-end', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        { platform: 'google', spend: 1234.5 },
        { platform: 'meta', spend: 765.5 },
      ],
    ]);
    mockFetch.mockResolvedValueOnce(
      llmResponse('You spent $2,000 over the last 7 days, split $1,235 Google and $766 Meta.'),
    );

    const { GET } = await import('../route');
    const res = await GET(
      makeGet('?client_id=acme&question_id=spend&period=7d'),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.question_id).toBe('spend');
    expect(json.client_id).toBe('acme');
    expect(json.period).toBe('7d');
    expect(json.answer).toContain('$2,000');
    expect(json.facts.available).toBe(true);
    expect(json.facts.facts.total_spend).toBe(2000);
  });

  it('returns availability=false for not-yet-wired questions without hitting BQ', async () => {
    mockFetch.mockResolvedValueOnce(
      llmResponse('Best-keywords data is not yet wired — keyword-entity rows are not yet ingested into daily_metrics.'),
    );

    const { GET } = await import('../route');
    const res = await GET(
      makeGet('?client_id=acme&question_id=best_keywords&period=7d'),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.facts.available).toBe(false);
    expect(typeof json.facts.not_available_reason).toBe('string');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('POST /api/questions (registry batch)', () => {
  it('answers multiple registry questions in one round trip', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ platform: 'google', spend: 100 }]])
      .mockResolvedValueOnce([
        [
          {
            platform: 'google',
            spend: 100,
            conversions: 5,
            conversion_value: 500,
          },
        ],
      ]);
    mockFetch
      .mockResolvedValueOnce(
        llmResponse('Spend was $100 over the last 7 days.'),
      )
      .mockResolvedValueOnce(
        llmResponse('5 conversions worth $500 over the last 7 days, ROAS 5.0.'),
      );

    const { POST } = await import('../route');
    const res = await POST(
      makePost({
        client_id: 'acme',
        question_ids: ['spend', 'revenue'],
        period: '7d',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answers).toHaveLength(2);
    expect(json.answers[0].question_id).toBe('spend');
    expect(json.answers[1].question_id).toBe('revenue');
    expect(json.answers[1].answer).toContain('ROAS');
  });

  it('rejects empty question_ids', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePost({ client_id: 'acme', question_ids: [] }));
    expect(res.status).toBe(400);
  });

  it('drops unknown ids and 400s when none remain valid', async () => {
    const { POST } = await import('../route');
    const res = await POST(
      makePost({ client_id: 'acme', question_ids: ['bogus', 'also-bogus'] }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('No valid question_ids');
  });
});
