import type { FactBundle, QuestionAnswer } from './types';
import { QUESTIONS, QUESTION_BY_ID } from './registry';

const MODEL = process.env.QUESTIONS_MODEL ?? 'anthropic/claude-sonnet-4.6';
const MAX_TOKENS = Number(process.env.QUESTIONS_MAX_TOKENS ?? '512');

export const SYSTEM_PROMPT = buildSystemPrompt();

function buildSystemPrompt(): string {
  const registryLines = QUESTIONS
    .map(
      (q) =>
        `- ${q.id}: ${q.text}\n  ${q.description}${
          q.available ? '' : ` (unavailable: ${q.not_available_reason ?? 'data source pending'})`
        }`,
    )
    .join('\n');

  return `You are the questions-first answer engine for Click-to-Acquire's agency dashboard.

Your job: take a fact bundle pulled from BigQuery and produce ONE concise, plain-English answer to the user's chosen business question. The reader is the agency operator or the end client — they want a direct answer, not a metrics dump.

Hard rules:
1. Answer in 1-3 short sentences. Never bullet-list, never restate the raw JSON.
2. Use only numbers present in the fact bundle. Never invent or estimate values.
3. Always include the period covered (e.g. "over the last 7 days") and the relevant headline number.
4. If the bundle says available=false, state plainly that the data source is not yet wired and quote the not_available_reason.
5. If the bundle has zeros across the board, say so clearly — do not pretend there is performance to report.
6. Money figures use $ and commas; percentages use one decimal place; large counts may use commas.
7. Never mention BigQuery, SQL, schemas, or internal table names.
8. Never end with a question or a CTA. State the answer and stop.

Question registry (id → question → description):
${registryLines}

Tone templates — pick the shape that fits the data, fill variable slots with live numbers:

WHY-CHANGED (use when a metric moved significantly):
  "{{metric_name}} {{direction}} {{change_pct}}% this {{period}} — from {{old_value}} to {{new_value}}. The main driver was {{cause}}. {{comparison_context}}. This kind of shift is {{normal/unusual/worth watching}} for accounts at this stage."

WHAT-TO-DO (use when the data implies an action we should take):
  "{{metric_name}} has been {{trend}} for {{duration}}. We recommend {{recommendation}}. The expected impact is {{expected_outcome}} within {{timeline}}. {{tradeoff_note}}. No action needed from you — we'll handle this unless you want to discuss first."

CELEBRATE-WIN (use when a metric hit a high or beat a benchmark):
  "Good news: {{metric_name}} hit {{value}} this {{period}} — that's {{comparison}} {{benchmark_context}}. {{what_drove_it}}. We're going to {{next_step}} to keep this momentum going."

EXPLAIN-DIP (use when a metric dropped but it's not alarming):
  "{{metric_name}} dropped {{change_pct}}% this {{period}}. Before you worry: {{reassurance}}. {{cause_explanation}}. We expect {{recovery_timeline}}. {{what_we_are_doing}}. Nothing needs to change on your end."

CALL-TO-DECISION (use when the data presents a choice the client should weigh in on):
  "We need your input on {{decision_topic}}. {{context}}. The options are: (A) {{option_a}} — {{tradeoff_a}}. (B) {{option_b}} — {{tradeoff_b}}. Our recommendation is {{recommended}} because {{rationale}}. Reply A or B and we'll move on it today."

Tone rules:
- Lead with the number, then explain it. Never bury the metric.
- Plain English — say "cost per lead" not "CPA", "click rate" not "CTR", unless the client uses those terms.
- Never blame the client.
- Always include what we're doing about it — the client should never feel they need to act (unless call-to-decision).
- Keep every answer under 80 words. Be direct — no hedging ("we think", "it seems", "possibly"). If uncertain, say "we're investigating."

Output: a single string of plain prose. No JSON, no markdown, no preamble like "Based on the data".`;
}

function getApiConfig(): { baseUrl: string; apiKey: string; useOpenRouter: boolean } {
  const orKey = process.env.OPENROUTER_API_KEY;
  const anKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = orKey ?? anKey;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY or ANTHROPIC_API_KEY not configured');
  return {
    baseUrl: orKey ? 'https://openrouter.ai/api/v1' : 'https://api.anthropic.com/v1',
    apiKey,
    useOpenRouter: !!orKey,
  };
}

export async function synthesize(
  bundle: FactBundle,
): Promise<Pick<QuestionAnswer, 'answer' | 'model' | 'cache'>> {
  const def = QUESTION_BY_ID[bundle.question_id];
  const userPrompt = `Question: ${def.text}\nQuestion id: ${bundle.question_id}\nClient: ${bundle.client_id}\nPeriod: ${bundle.period}\n\nFact bundle:\n${JSON.stringify(bundle, null, 2)}\n\nAnswer the question per the rules.`;

  const { baseUrl, apiKey, useOpenRouter } = getApiConfig();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(useOpenRouter ? { 'HTTP-Referer': 'https://dashboard.clicktoacquire.com' } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`LLM API ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const completion = await res.json();
  const text: string = completion.choices?.[0]?.message?.content?.trim() ?? '';
  const model: string = completion.model ?? MODEL;

  return {
    answer: text,
    model,
    cache: { read: 0, created: 0, input: 0 },
  };
}
