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
