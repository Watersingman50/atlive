// Hand-built, dependency-free chart components for the /pipeline dashboard.
// All server components (no client JS). Styled with the shared CSS tokens.
// Every chart carries a visible numeric value (so it doubles as its own data
// table) plus an aria-label. Motion is CSS-only and disabled by the global
// prefers-reduced-motion rule in globals.css.

import type { EvalResult } from "@/lib/extraction-eval";
import type { PipelineStats } from "@/lib/events";

function rel(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ----------------------------- architecture flow ----------------------------- */

const STAGES: { t: string; s: string }[] = [
  { t: "INGEST SOURCES", s: "Ticketmaster · 529 · Variety · Terminal West" },
  { t: "GITHUB ACTIONS", s: "scheduled ingest · every 6h" },
  { t: "NORMALIZE", s: "pure parsers → CanonicalEvent[]" },
  { t: "DEDUPE", s: "exact key → fuzzy → false-merge guard" },
  { t: "SUPABASE", s: "events 1─N event_sources" },
  { t: "NEXT.JS · VERCEL", s: "ISR · revalidates hourly" },
];
const BOX_H = 50;
const STEP = 78;
const TOP = 8;

export function ArchitectureFlow() {
  const height = TOP * 2 + STAGES.length * BOX_H + (STAGES.length - 1) * (STEP - BOX_H);
  return (
    <figure className="chart">
      <svg
        className="flow"
        viewBox={`0 0 360 ${height}`}
        role="img"
        aria-labelledby="flow-title flow-desc"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="flow-title">ATLive ingestion pipeline architecture</title>
        <desc id="flow-desc">
          Six stages top to bottom: ingest sources, GitHub Actions cron every six hours, normalize, dedupe, Supabase,
          then the Next.js site on Vercel.
        </desc>
        {STAGES.map((st, i) => {
          const y = TOP + i * STEP;
          return (
            <g key={st.t}>
              {i > 0 && (
                <g className="flow-arrow">
                  <line x1="180" y1={y - (STEP - BOX_H) + 2} x2="180" y2={y - 4} />
                  <path d="M174 -10 L180 -2 L186 -10 Z" transform={`translate(0 ${y})`} className="flow-head" />
                </g>
              )}
              <rect className="flow-box" x="30" y={y} width="300" height={BOX_H} rx="12" />
              <text className="flow-tag" x="44" y={y + 19}>{`0${i + 1}`}</text>
              <text className="flow-label" x="180" y={y + 22} textAnchor="middle">{st.t}</text>
              <text className="flow-sub" x="180" y={y + 38} textAnchor="middle">{st.s}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="chart-cap">
        The real path a listing travels, from source to screen. The dedupe and normalize steps are the measured ones
        below.
      </figcaption>
    </figure>
  );
}

/* --------------------------- per-field accuracy bars --------------------------- */

const FIELD_LABEL: Record<string, string> = { artist: "Artist", date: "Date", venue: "Venue" };

export function AccuracyBars({ result }: { result: EvalResult }) {
  return (
    <figure className="chart">
      <div className="bars" role="img" aria-label={`Field-level extraction accuracy: ${result.byField
        .map((f) => `${f.field} ${f.correct} of ${f.total}`)
        .join(", ")}. Overall ${result.overall.pct} percent.`}>
        {result.byField.map((f) => {
          const pct = f.total ? Math.round((f.correct / f.total) * 100) : 0;
          return (
            <div className="bar-row" key={f.field}>
              <span className="bar-label">{FIELD_LABEL[f.field] ?? f.field}</span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="bar-val">
                {f.correct}/{f.total} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="chart-cap">
        {result.overall.correct}/{result.overall.total} fields correct ({result.overall.pct}%) vs hand-labeled ground
        truth across {result.labeledCount} events. Only artist, date, and venue have ground truth, so only they are
        charted.
      </figcaption>
    </figure>
  );
}

/* ----------------------------- events per source ----------------------------- */

export function SourceBars({ sources }: { sources: PipelineStats["by_source"] }) {
  const sorted = [...sources].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((s) => s.count));
  return (
    <figure className="chart">
      <div className="bars" role="img" aria-label={`Events per source: ${sorted
        .map((s) => `${s.source} ${s.count}`)
        .join(", ")}.`}>
        {sorted.map((s) => (
          <div className="bar-row" key={s.source}>
            <span className="bar-label cap">{s.source}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <span className="bar-val">
              {s.count} <span className="bar-sub">· {rel(s.last_seen)}</span>
            </span>
          </div>
        ))}
      </div>
      <figcaption className="chart-cap">Events contributed per source, with the last successful pull.</figcaption>
    </figure>
  );
}

/* --------------------------------- dedup viz --------------------------------- */

export function DedupViz({ sourceRows, events, merges }: { sourceRows: number; events: number; merges: number }) {
  const collapsed = sourceRows - events;
  const keptPct = sourceRows ? (events / sourceRows) * 100 : 0;
  return (
    <figure className="chart">
      <div className="dedup" role="img" aria-label={`${sourceRows} raw source rows collapsed to ${events} canonical events; ${collapsed} duplicates removed; ${merges} seen in more than one source.`}>
        <div className="dedup-row">
          <span className="dedup-k">Raw source rows</span>
          <span className="dedup-bar"><span className="dedup-fill raw" style={{ width: "100%" }} /></span>
          <span className="dedup-v">{sourceRows}</span>
        </div>
        <div className="dedup-row">
          <span className="dedup-k">Canonical events</span>
          <span className="dedup-bar"><span className="dedup-fill kept" style={{ width: `${keptPct}%` }} /></span>
          <span className="dedup-v">{events}</span>
        </div>
        <div className="dedup-chips">
          <span className="chip multi">{collapsed} duplicates collapsed</span>
          <span className="chip">{merges} seen in 2+ sources</span>
        </div>
      </div>
      <figcaption className="chart-cap">
        Match is exact-key first, then a token-set fuzzy fallback, guarded by a false-merge test so two different acts
        on the same night never merge. (No precision/recall here — there&apos;s no labeled dedup ground truth to score
        against, so it&apos;s not invented.)
      </figcaption>
    </figure>
  );
}

/* -------------------------------- ingest runs -------------------------------- */

export function IngestVolume({ runs }: { runs: PipelineStats["runs"] }) {
  if (runs.length === 0) {
    return <p className="note">No runs recorded yet — the next scheduled ingest will populate this.</p>;
  }
  // oldest → newest for a left-to-right timeline
  const ordered = [...runs].reverse();
  const vol = (r: PipelineStats["runs"][number]) => r.source_rows ?? r.created ?? 0;
  const max = Math.max(1, ...ordered.map(vol));
  return (
    <figure className="chart">
      <div className="cols" role="img" aria-label={`${runs.length} ingest runs recorded, all ${
        runs.every((r) => r.status === "success") ? "successful" : "with some failures"
      }.`}>
        {ordered.map((r, i) => (
          <div className="col" key={i}>
            <span className="col-v">{vol(r)}</span>
            <span
              className={`col-bar ${r.status === "success" ? "ok" : "bad"}`}
              style={{ height: `${Math.max(6, (vol(r) / max) * 100)}%` }}
              aria-hidden="true"
            />
            <span className="col-x">{rel(r.ran_at)}</span>
          </div>
        ))}
      </div>
      <figcaption className="chart-cap">
        Source rows pulled per run ({runs.length} recorded). Upserts are idempotent, so re-runs add few new rows by
        design — the value is consistency, not growth.
      </figcaption>
    </figure>
  );
}
