# ATLive — Automated Atlanta Live-Event Discovery

A scheduled pipeline that aggregates live-music events across Atlanta from multiple
sources, normalizes and **dedupes** them (preserving provenance), generates a short
AI blurb per show, and publishes a filterable "what's on this week" site.

**Live:** https://atlive.vercel.app

This repo is the engineering story, not a CRUD app: a self-running multi-source
ingestion pipeline with provenance-preserving dedup (guarded by tests), a
measured extraction-quality eval, and a polished deployed frontend.

## Architecture

```
                    GitHub Actions — scheduled every 6h  (no Vercel timeout wall)
                                          │
            ┌─────────────────────────────┴─────────────────────────────┐
            │                          INGEST                            │
            │                                                            │
   Ticketmaster Discovery API ─┐                                         │
   529  (static HTML scrape) ──┼─▶ SourceAdapter.fetch()                 │
   Variety (AEG JSON feed) ────┘        │                               │
                                        ▼   pure parsers (eval-tested)   │
                                  CanonicalEvent[]                       │
                                        │  normalize                     │
                                        ▼                                │
                                  DEDUP                                  │
                                  exact canonical_key                    │
                                  → fuzzy fallback (token-set)           │
                                  → false-merge guard (tested)           │
                                        │                                │
                                        ▼                                │
                            claude-haiku-4-5 blurb (generate-once)       │
                                        │                                │
                                        ▼                                │
                            Supabase (Postgres)                          │
                            events  1───N  event_sources  (provenance)   │
            └────────────────────────┬───────────────────────────────────┘
                                     │  single embedded-join query, cached via ISR
                                     ▼
                         Next.js site on Vercel
                  date / venue / genre filters · Framer Motion · live stat
                  never-empty (ISR last-good) · freshness banner · Vercel Analytics
```

## What it demonstrates

- **Multi-source ingestion** through one `SourceAdapter` interface — a clean API
  source (Ticketmaster), a static-HTML scrape (529), and a JSON feed (Variety).
- **Provenance-preserving dedup.** One canonical `events` row per real show, with
  every source linked in `event_sources` — so the same show seen on Ticketmaster
  *and* Variety merges into one card that says "seen in 2 sources." Exact-key match
  with a fuzzy fallback, and a **false-merge guard test** so two different acts on
  the same night never merge.
- **A measured eval, not vibes.** The extraction step is scored against hand-labeled
  ground truth — see below.
- **Runs itself.** GitHub Actions ingests every 6h; the site serves cached data via
  ISR and never goes blank (last-good render + freshness banner); failed runs open
  an issue.
- **AI, done honestly.** A Haiku blurb per event, generated once and stored, with a
  graceful skip on failure — and the eval targets the *extractable* step (real
  ground truth), not blurb taste.

## Eval results

`npm run eval` scores artist/date/venue extraction from the captured raw fixtures
against `eval/labels.ts` (hand-labeled ground truth):

```
Extraction accuracy: 29/30 fields correct (96.7%) across 10 labeled events
Misses:
  - variety:1458556  artist: expected "feeble little horse", got "feeble little horse: bitknot tour"
```

The one miss is real and intentional to keep: the parser strips `" - "` tour
suffixes but not `": "` ones. An eval that always reads 100% is usually rigged —
this one surfaces actual extraction edge cases and guards against regressions.

## Tech stack

Next.js 16 (App Router, ISR) · React 19 · TypeScript · Supabase (Postgres) ·
Ticketmaster Discovery API · cheerio · Anthropic SDK (claude-haiku-4-5) ·
Framer Motion · Vercel (hosting + Analytics) · GitHub Actions (scheduled ingest).

## Project layout

```
app/                 Next.js site (server page → client EventsBoard)
src/lib/sources/     SourceAdapter implementations (+ pure parsers)
src/lib/dedup.ts     fuzzy matcher (+ dedup.test.ts)
src/lib/db.ts        idempotent upsert with exact→fuzzy dedup
src/lib/llm/         Haiku blurb generation
src/ingest/run.ts    ingest entrypoint (runs in GitHub Actions)
supabase/migrations/ schema
eval/                extraction-accuracy harness + labeled fixtures
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run ingest` | Fetch all sources → dedupe → upsert → blurbs (the cron job) |
| `npm run ingest:dry` | Fetch + normalize, print sample, no DB writes |
| `npm run db:apply` | Apply the schema migration |
| `npm test` | Dedup matcher tests, incl. the false-merge guard |
| `npm run eval` | Extraction-accuracy eval (prints the number above) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |

## Local dev

```bash
npm install
cp .env.example .env.local   # fill TM_API_KEY, SUPABASE_*; ANTHROPIC_API_KEY optional
npm run ingest:dry           # see real Ticketmaster data with no DB
# with Supabase configured:
npm run db:apply && npm run ingest && npm run dev
```

## Deployment

- **Ingestion** runs in GitHub Actions (`.github/workflows/ingest.yml`) on a 6h
  cron — not Vercel cron, to avoid the serverless execution-time limit. Secrets:
  `TM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
- **Site** deploys to Vercel and reads Supabase server-side with ISR (revalidate 1h).

## Status

- [x] Multi-source ingestion (Ticketmaster + 529 + Variety) via `SourceAdapter`
- [x] Canonical `events` + `event_sources` schema, idempotent upsert
- [x] Dedup: exact key + fuzzy fallback + false-merge guard test
- [x] Extraction-accuracy eval (96.7%)
- [x] Next.js site: filters, animations, live stat, never-empty + freshness
- [x] Scheduled ingest in CI, with failure alerting
- [~] AI blurbs (claude-haiku-4-5) — code complete; activates when API credits are added
- [ ] Weekly email digest (Resend)
