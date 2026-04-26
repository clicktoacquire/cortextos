import { describe, it, expect } from 'vitest';
import { QUESTIONS, QUESTION_BY_ID, isQuestionId } from '../registry';

describe('questions registry', () => {
  it('exposes the 13 registry questions (10 PRD + 3 CRO additions)', () => {
    expect(QUESTIONS).toHaveLength(13);
    const ids = QUESTIONS.map((q) => q.id).sort();
    expect(ids).toEqual(
      [
        'best_ads',
        'best_audiences',
        'best_creatives',
        'best_keywords',
        'best_lp_variant',
        'cost_per_lead',
        'goal_vs_actual',
        'next_test',
        'pacing',
        'recommendations',
        'revenue',
        'spend',
        'trend_vs_prior',
      ].sort(),
    );
  });

  it('marks every unavailable question with a not_available_reason', () => {
    for (const q of QUESTIONS) {
      if (!q.available) {
        expect(q.not_available_reason).toBeTruthy();
        expect(typeof q.not_available_reason).toBe('string');
      } else {
        expect(q.not_available_reason).toBeUndefined();
      }
    }
  });

  it('keeps QUESTION_BY_ID in sync with QUESTIONS', () => {
    for (const q of QUESTIONS) {
      expect(QUESTION_BY_ID[q.id]).toEqual(q);
    }
  });

  it('isQuestionId narrows correctly', () => {
    expect(isQuestionId('spend')).toBe(true);
    expect(isQuestionId('revenue')).toBe(true);
    expect(isQuestionId('not_a_real_question')).toBe(false);
    expect(isQuestionId('')).toBe(false);
  });
});
