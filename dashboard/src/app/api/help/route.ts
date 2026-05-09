import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const KB_DIR = path.resolve(process.cwd(), '../agency-os/knowledge-base');

function loadKbContext(query: string): string {
  if (!fs.existsSync(KB_DIR)) return '';

  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith('.md'));
  const q = query.toLowerCase();

  // Simple keyword relevance: score each file by how many query words appear in its filename
  const words = q.split(/\s+/).filter((w) => w.length > 3);
  const scored = files
    .map((f) => {
      const score = words.filter((w) => f.toLowerCase().includes(w)).length;
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);

  const topFiles = (scored[0]?.score > 0 ? scored.slice(0, 2) : scored.slice(0, 2)).map((s) => s.f);

  const snippets = topFiles
    .map((f) => {
      const content = fs.readFileSync(path.join(KB_DIR, f), 'utf-8').slice(0, 2000);
      return `## ${f}\n${content}`;
    })
    .join('\n\n');

  return snippets;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
  }

  const kbContext = loadKbContext(question);
  const systemPrompt = [
    'You are the CTA Platform training agent, embedded in the admin dashboard.',
    'Answer questions about the platform, ad operations, and agency workflows concisely.',
    kbContext
      ? `Relevant knowledge base context:\n\n${kbContext}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  });

  const text =
    message.content[0]?.type === 'text' ? message.content[0].text : '';

  return NextResponse.json({ answer: text });
}
