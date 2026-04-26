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

const SAMPLE_ROWS = [
  {
    metric_date: { value: '2026-04-20' },
    platform: 'google',
    total_spend: 500.0,
    total_conversions: 25,
    total_clicks: 200,
    total_impressions: 5000,
  },
  {
    metric_date: { value: '2026-04-20' },
    platform: 'meta',
    total_spend: 300.0,
    total_conversions: 15,
    total_clicks: 120,
    total_impressions: 4000,
  },
];

function llmResponse(text: string) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: text } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

describe('POST /api/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-or-key';
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns 400 when question is missing', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({ client_id: '94e648dd-9eb0-4ef0-83e9-de3c62edec31' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('question');
  });

  it('returns 400 when client_id is not a valid UUID', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({ question: 'test?', client_id: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('UUID');
  });

  it('returns answer with correct shape on success', async () => {
    mockQuery.mockResolvedValueOnce([SAMPLE_ROWS]);
    mockFetch.mockResolvedValueOnce(
      llmResponse('Your CPL went up because spend increased while conversions held flat.'),
    );

    const { POST } = await import('../route');
    const res = await POST(
      makeRequest({
        question: 'Why did my CPL go up last week?',
        client_id: '94e648dd-9eb0-4ef0-83e9-de3c62edec31',
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('answer');
    expect(json).toHaveProperty('supporting_metrics');
    expect(json).toHaveProperty('asked_at');
    expect(typeof json.answer).toBe('string');
    expect(json.answer).toContain('CPL');
    expect(json.supporting_metrics).toHaveProperty('google');
    expect(json.supporting_metrics).toHaveProperty('meta');
  });

  it('returns fallback when no BQ rows found', async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const { POST } = await import('../route');
    const res = await POST(
      makeRequest({
        question: 'How are we doing?',
        client_id: '94e648dd-9eb0-4ef0-83e9-de3c62edec31',
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toContain('No performance data');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes correct params to BQ query', async () => {
    mockQuery.mockResolvedValueOnce([SAMPLE_ROWS]);
    mockFetch.mockResolvedValueOnce(llmResponse('Test answer.'));

    const { POST } = await import('../route');
    await POST(
      makeRequest({
        question: 'test',
        client_id: '94e648dd-9eb0-4ef0-83e9-de3c62edec31',
      }),
    );

    expect(mockQuery).toHaveBeenCalledOnce();
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.params.clientId).toBe('94e648dd-9eb0-4ef0-83e9-de3c62edec31');
    expect(callArgs.params.days).toBe(30);
  });

  it('returns 500 when no API key is configured', async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const { POST } = await import('../route');
    const res = await POST(
      makeRequest({
        question: 'test?',
        client_id: '94e648dd-9eb0-4ef0-83e9-de3c62edec31',
      }),
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('not configured');
  });
});
