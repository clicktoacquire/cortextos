export type Period = '7d' | '14d' | '30d' | 'mtd';

export interface QuestionRequest {
  client_id: string;
  question_id: QuestionId;
  period: Period;
}

export type QuestionId =
  | 'spend'
  | 'revenue'
  | 'best_keywords'
  | 'best_ads'
  | 'best_audiences'
  | 'best_creatives'
  | 'trend_vs_prior'
  | 'next_test'
  | 'best_lp_variant'
  | 'pacing';

export interface FactBundle {
  question_id: QuestionId;
  period: Period;
  client_id: string;
  generated_at: string;
  available: boolean;
  not_available_reason?: string;
  facts?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
}

export interface QuestionAnswer {
  question_id: QuestionId;
  question_text: string;
  client_id: string;
  period: Period;
  answer: string;
  facts: FactBundle;
  model: string;
  cache: { read: number; created: number; input: number };
}
