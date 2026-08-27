# ATLive

Every gig in Atlanta this week, in one place, updated automatically.

A live board of live-music shows across Atlanta. Poster-style listings you can filter by
date, venue, neighborhood, and genre, and it keeps itself current, so nobody maintains a
list by hand.

Live at https://atlive.vercel.app

![ATLive, live music in Atlanta](docs/home.png)

## How it works

The board is the easy part. Underneath it is a self-running ingestion pipeline that
pulls from several sources, dedupes without losing provenance, scores its own extraction
accuracy against labeled data, and reports all of it on a live data-quality dashboard at
[`/pipeline`](https://atlive.vercel.app/pipeline).

![ATLive pipeline and data-quality dashboard](docs/pipeline.png)

The flow: four sources, a GitHub Actions cron every 6h, normalize, dedupe, Supabase,
then the Next.js site via ISR. I don't use Vercel cron. Ingestion runs in Actions
instead, which dodges the serverless execution-time limit.

### The parts worth looking at

All four sources go through one `SourceAdapter` interface even though they look nothing
alike: Ticketmaster Discovery is a clean API, 529 is a static-HTML scrape, and Variety
Playhouse and Terminal West come from AEG JSON feeds.

Dedup preserves provenance. There is one canonical `events` row per real show, with
every source linked in `event_sources`, so a show seen on Ticketmaster *and* Variety
merges into one card that says "seen in 2 sources." Matching is exact-key first with a
token-set fuzzy fallback, and a false-merge guard test makes sure two different acts on
the same night never collapse into one.

The extraction step is measured, not eyeballed. It's scored against hand-labeled ground
truth (see below), and the `/pipeline` page charts the same numbers live.

The whole thing runs itself. Actions ingests every 6h, the site serves cached data via
ISR and never goes blank (last-good render plus a freshness banner), and a failed run
opens an issue. A weekly email digest goes out Monday mornings through Resend.

Each event gets a `claude-haiku-4-5` blurb, generated once and stored, with a graceful
skip on failure. I pointed the eval at the extraction step, where there is real ground
truth, rather than at blurb quality, where there isn't.

### Eval results

`npm run eval` scores artist, date, and venue extraction from captured raw fixtures
against the hand-labeled ground truth in `eval/labels.ts`, then writes
`eval/results.json`. The `/pipeline` page imports that file, so the number on the site is
the number the harness computed.

```
Extraction accuracy: 29/30 fields correct (96.7%) across 10 labeled events
Per field: artist 9/10  ·  date 10/10  ·  venue 10/10
Misses:
  - variety:1458556  artist: expected "feeble little horse", got "feeble little horse: bitknot tour"
```

I kept that one miss on purpose. The parser strips `" - "` tour suffixes but not `": "`
ones, which is a real edge case. An eval that always reads 100% is usually rigged, and
this one catches regressions.

### Tech stack

Next.js 16 (App Router, ISR) · React 19 · TypeScript · Supabase (Postgres) ·
Ticketmaster Discovery API · cheerio · Anthropic SDK (claude-haiku-4-5) ·
Framer Motion · Resend · Vercel (hosting + Analytics) · GitHub Actions (scheduled
ingest + weekly digest).

### Project layout

```
app/                    Next.js site (server page → client EventsBoard)
app/pipeline/           data-quality dashboard (hand-built SVG/CSS charts)
app/[slug]/             neighborhood + genre SEO landing pages (static, ISR)
src/lib/sources/        SourceAdapter implementations (+ pure parsers)
src/lib/dedup.ts        fuzzy matcher (+ dedup.test.ts)
src/lib/db.ts           idempotent upsert with exact→fuzzy dedup
src/lib/neighborhoods.ts venue → Atlanta neighborhood map
src/lib/landing.ts      landing-page config + match logic (keyword map plugs in here)
src/lib/extraction-eval.ts  shared eval scorer (CLI + site)
src/ingest/run.ts       ingest entrypoint (runs in GitHub Actions)
src/digest/send.ts      weekly email digest (Resend)
src/social/             weekly auto-post (Bluesky/X) + IG/Reddit draft pack
supabase/migrations/    schema + pipeline_stats() RPC
eval/                   extraction-accuracy harness + labeled fixtures
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run ingest` | Fetch all sources → dedupe → upsert → blurbs (the cron job) |
| `npm run ingest:dry` | Fetch + normalize, print sample, no DB writes |
| `npm run db:apply` | Apply the schema migration |
| `npm run digest` | Send the weekly email digest |
| `npm run draftpack` | Build the IG + Reddit draft pack (writes `drafts/`, emails owner) |
| `npm run social` | Auto-post the weekly lineup to Bluesky + X (no-op without keys) |
| `npm test` | Pure-logic tests: dedup guard, landing match, social copy, OAuth signing |
| `npm run eval` | Extraction-accuracy eval (prints the number above) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |

### Local dev

```bash
npm install
cp .env.example .env.local   # fill TM_API_KEY, SUPABASE_*; ANTHROPIC_API_KEY optional
npm run ingest:dry           # see real Ticketmaster data with no DB
# with Supabase configured:
npm run db:apply && npm run ingest && npm run dev
```

### Deployment

Ingestion runs in GitHub Actions (`.github/workflows/ingest.yml`) on a 6h cron. It needs
`TM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY` as
secrets. The weekly digest (`digest.yml`) adds `RESEND_API_KEY` and `DIGEST_TO`.

Growth runs weekly in `social.yml`. It auto-posts the lineup to Bluesky and X
(per-platform keys, optional) and emails the IG/Reddit draft pack for manual posting.
Every platform is a no-op until its keys are set.

The site deploys to Vercel and reads Supabase server-side with ISR (revalidate 1h). For
a custom domain, set `NEXT_PUBLIC_SITE_URL`, and canonicals, sitemap, OG, and email
links all follow.

## Status

- [x] Multi-source ingestion (Ticketmaster + 529 + Variety + Terminal West) via `SourceAdapter`
- [x] Canonical `events` + `event_sources` schema, idempotent upsert
- [x] Dedup: exact key + fuzzy fallback + false-merge guard test
- [x] Extraction-accuracy eval (96.7%), charted live on `/pipeline`
- [x] Next.js site: poster cards, date/venue/neighborhood/genre filters, never-empty + freshness
- [x] `/pipeline` data-quality dashboard (architecture + real-data charts)
- [x] Scheduled ingest in CI, with failure alerting
- [x] Weekly email digest (Resend)
- [x] SEO: JSON-LD, sitemap, canonical tags + neighborhood/genre landing pages
- [x] Newsletter: double opt-in signup → confirmed-subscriber digest
- [x] Growth automation: weekly Bluesky/X auto-post + IG/Reddit draft pack
- [~] AI blurbs (claude-haiku-4-5): code complete, activates when API credits are added
