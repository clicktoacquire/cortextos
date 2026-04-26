'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconLoader2, IconMessageQuestion, IconClock, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface QuestionDef {
  id: string;
  text: string;
  available: boolean;
  not_available_reason?: string;
}

interface AnswerResult {
  question_id: string;
  question_text: string;
  client_id: string;
  period: string;
  answer: string;
  facts: {
    available: boolean;
    not_available_reason?: string;
    facts?: Record<string, unknown>;
  };
  model: string;
}

const PERIODS = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: 'mtd', label: 'Month to date' },
] as const;

export function AnswersClient() {
  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState<string>('7d');
  const [loading, setLoading] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    fetch('/api/questions')
      .then((r) => r.json())
      .then((data) => setQuestions(data.questions ?? []))
      .catch(() => setError('Failed to load questions'));
  }, []);

  const askQuestion = useCallback(
    async (questionId: string) => {
      if (!clientId.trim()) {
        setError('Enter a client ID first');
        return;
      }
      setError(null);
      setLoading(questionId);
      try {
        const params = new URLSearchParams({
          client_id: clientId.trim(),
          question_id: questionId,
          period,
        });
        const res = await fetch(`/api/questions?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Error ${res.status}`);
          return;
        }
        setAnswers((prev) => ({ ...prev, [questionId]: data }));
      } catch {
        setError('Failed to fetch answer');
      } finally {
        setLoading(null);
      }
    },
    [clientId, period],
  );

  const askAll = useCallback(async () => {
    if (!clientId.trim()) {
      setError('Enter a client ID first');
      return;
    }
    setError(null);
    setBatchLoading(true);
    const available = questions.filter((q) => q.available).map((q) => q.id);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId.trim(),
          question_ids: available,
          period,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      const newAnswers: Record<string, AnswerResult> = {};
      for (const a of data.answers ?? []) {
        if (a.answer) newAnswers[a.question_id] = a;
      }
      setAnswers((prev) => ({ ...prev, ...newAnswers }));
    } catch {
      setError('Batch request failed');
    } finally {
      setBatchLoading(false);
    }
  }, [clientId, period, questions]);

  const availableCount = questions.filter((q) => q.available).length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. acme"
              className="h-8 w-48 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Period</label>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    'h-8 rounded-lg px-2.5 text-xs font-medium transition-colors',
                    period === p.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={askAll}
            disabled={batchLoading || !clientId.trim()}
          >
            {batchLoading ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconMessageQuestion size={14} />
            )}
            Ask all {availableCount}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <IconAlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {questions.map((q) => {
          const answer = answers[q.id];
          const isLoading = loading === q.id;

          return (
            <Card key={q.id} size="sm" className={cn(!q.available && 'opacity-60')}>
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-tight">{q.text}</CardTitle>
                  <Badge
                    variant={q.available ? 'secondary' : 'outline'}
                    className="shrink-0 text-[10px]"
                  >
                    {q.available ? 'Live' : 'Pending'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {!q.available && q.not_available_reason && (
                  <p className="text-xs text-muted-foreground mb-2">{q.not_available_reason}</p>
                )}

                {answer ? (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm leading-relaxed">{answer.answer}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <IconCheck size={12} className="text-green-500" />
                      <span>{answer.period}</span>
                      <span>&middot;</span>
                      <span>{answer.model?.split('/').pop()}</span>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isLoading || !clientId.trim()}
                    onClick={() => askQuestion(q.id)}
                  >
                    {isLoading ? (
                      <>
                        <IconLoader2 size={14} className="animate-spin" />
                        Asking...
                      </>
                    ) : (
                      <>
                        <IconClock size={14} />
                        Ask
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
