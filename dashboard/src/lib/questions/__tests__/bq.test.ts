import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: class MockBigQuery {
    query = mockQuery;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('periodBounds', () => {
  it('computes inclusive 7d window ending today', async () => {
    const { periodBounds } = await import('../bq');
    const today = new Date('2026-04-25T12:00:00Z');
    const b = periodBounds('7d', today);
    expect(b.end).toBe('2026-04-25');
    expect(b.start).toBe('2026-04-19');
    expect(b.days).toBe(7);
  });

  it('computes mtd from the first of the month', async () => {
    const { periodBounds } = await import('../bq');
    const today = new Date('2026-04-25T12:00:00Z');
    const b = periodBounds('mtd', today);
    expect(b.start).toBe('2026-04-01');
    expect(b.end).toBe('2026-04-25');
    expect(b.days).toBe(25);
  });
});

describe('fetchFacts', () => {
  it('short-circuits unavailable questions without querying BQ', async () => {
    const { fetchFacts } = await import('../bq');
    const bundle = await fetchFacts('best_keywords', 'acme', '7d');
    expect(bundle.available).toBe(false);
    expect(bundle.not_available_reason).toContain('Keyword');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('aggregates spend across platforms', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        { platform: 'google', spend: 1234.5 },
        { platform: 'meta', spend: 765.5 },
      ],
    ]);
    const { fetchFacts } = await import('../bq');
    const bundle = await fetchFacts('spend', 'acme', '7d');
    expect(bundle.available).toBe(true);
    expect(bundle.facts).toBeDefined();
    expect(bundle.facts!.total_spend).toBe(2000);
    expect((bundle.facts!.by_platform as unknown[]).length).toBe(2);

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.params.client_id).toBe('acme');
    expect(callArgs.query).toContain('FROM `click-to-acquire.analytics.daily_metrics`');
    expect(callArgs.query).toContain("entity_type = 'campaign'");
  });

  it('returns trend deltas vs prior window', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        { bucket: 'current', spend: 200, conversions: 10, conversion_value: 2000 },
        { bucket: 'prior', spend: 100, conversions: 5, conversion_value: 1000 },
      ],
    ]);
    const { fetchFacts } = await import('../bq');
    const bundle = await fetchFacts('trend_vs_prior', 'acme', '7d');
    expect(bundle.available).toBe(true);
    const facts = bundle.facts as Record<string, Record<string, number>>;
    expect(facts.deltas.spend_pct).toBe(100);
    expect(facts.deltas.conversions_pct).toBe(100);
    expect(facts.deltas.conversion_value_pct).toBe(100);
  });

  it('queries ad-level rows for best_ads', async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          platform: 'meta',
          entity_id: 'ad_1',
          campaign_id: 'c_1',
          spend: 100,
          conversions: 5,
          conversion_value: 500,
          cpa: 20,
        },
      ],
    ]);
    const { fetchFacts } = await import('../bq');
    const bundle = await fetchFacts('best_ads', 'acme', '14d');
    expect(bundle.rows).toBeDefined();
    expect(bundle.rows!.length).toBe(1);
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.query).toContain("entity_type = 'ad'");
    expect(callArgs.query).toContain('LIMIT 10');
  });
});
