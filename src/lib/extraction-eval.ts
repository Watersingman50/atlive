// Pure scorer for the extraction eval (T5). Kept dependency-free (no fs, no
// fixtures) so it can run in the CLI harness AND have its result type consumed
// by the /pipeline page. The harness (eval/run.ts) builds the parsed map from
// the captured fixtures and calls scoreExtraction(); it also serializes the
// result to eval/results.json, which the page imports. One source of truth —
// the number on the page is byte-for-byte the number the harness computes.

export interface LabelLike {
  source: string;
  id: string;
  artist: string;
  eventDate: string;
  venue: string;
}

export interface ParsedLike {
  artist: string | null;
  eventDate: string | null;
  venueName: string | null;
}

export interface FieldResult {
  field: "artist" | "date" | "venue";
  correct: number;
  total: number;
}

export interface Miss {
  id: string;
  field: string;
  expected: string;
  got: string;
}

export interface EvalResult {
  overall: { correct: number; total: number; pct: number };
  byField: FieldResult[];
  misses: Miss[];
  labeledCount: number;
}

export function scoreExtraction(parsed: Map<string, ParsedLike>, labels: LabelLike[]): EvalResult {
  const fields: FieldResult[] = [
    { field: "artist", correct: 0, total: 0 },
    { field: "date", correct: 0, total: 0 },
    { field: "venue", correct: 0, total: 0 },
  ];
  const misses: Miss[] = [];

  for (const L of labels) {
    const e = parsed.get(`${L.source}:${L.id}`);
    const checks: [FieldResult, string, string | null | undefined][] = [
      [fields[0]!, L.artist, e?.artist],
      [fields[1]!, L.eventDate, e?.eventDate],
      [fields[2]!, L.venue, e?.venueName],
    ];
    for (const [fr, expected, got] of checks) {
      fr.total++;
      if (got === expected) fr.correct++;
      else misses.push({ id: `${L.source}:${L.id}`, field: fr.field, expected, got: got ?? "(not found)" });
    }
  }

  const correct = fields.reduce((n, f) => n + f.correct, 0);
  const total = fields.reduce((n, f) => n + f.total, 0);
  return {
    overall: { correct, total, pct: total ? Math.round((correct / total) * 1000) / 10 : 0 },
    byField: fields,
    misses,
    labeledCount: labels.length,
  };
}
