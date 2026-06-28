# ATLive — Automated Atlanta Live-Event Discovery

An automated pipeline that ingests live-music events across Atlanta, normalizes and
dedupes them, and publishes a "what's on this week" site + weekly digest.

This repo is the engineering story: a scheduled multi-source ingestion pipeline with
provenance-preserving dedup and an evaluated extraction step — not a CRUD app.

**Live:** https://atlive.vercel.app

## Architecture

```
 GitHub Actions (cron)
        │
        ▼
 SourceAdapter[]  ── Ticketmaster Discovery API (Stage A spine)
        │           ── 529 scraper        (Stage B, novel: not in TM)
        │           ── Variety scraper     (Stage B, overlap: also in TM → dedup demo)
        ▼
 normalize → canonical_key → dedup (exact + fuzzy)
        ▼
 Supabase (Postgres):  events (canonical)  ◄─1:N─  event_sources (provenance)
        ▼
 Next.js "this week" site   +   Resend weekly digest
```

## Status

- [x] **T1** — data sources verified (TM Discovery API covers Atlanta: ~26 music events/8 days,
      12 venues; 529 = static-HTML scrape; Variety Playhouse = TM∩own-site overlap)
- [x] **T2** — scheduled GitHub Actions ingest workflow (`.github/workflows/ingest.yml`)
- [x] **T3** — `events` + `event_sources` schema with idempotent upsert (`supabase/migrations/0001_init.sql`)
- [x] **T7** — 529 (cheerio) + Variety (AEG JSON feed) source adapters — **live**, cross-source dedup badge working (Josiah & the Bonnevilles merges TM + Variety)
- [x] **T4** — dedup: exact key + fuzzy fallback (`src/lib/dedup.ts`) + false-merge guard test (`npm test`, 4/4 pass)
- [ ] T5 — extraction-accuracy eval harness
- [ ] T6 — liveness: never-empty render + TM-only degradation + freshness
- [~] **T8** — LLM blurb (Haiku, generate-once) — code complete + integration-verified; **awaiting Anthropic API credits** to produce output
- [x] **T9** — Next.js "this week" page (single join + ISR) — **deployed to Vercel (atlive.vercel.app)**
- [ ] T10 — Resend weekly digest
- [ ] T11 — README polish + eval results

## Local dev

```bash
npm install
cp .env.example .env.local      # fill TM_API_KEY (already set), Supabase later

# fetch real Ticketmaster data without touching a DB:
npm run ingest:dry

# once Supabase exists: apply supabase/migrations/0001_init.sql, fill SUPABASE_* in
# .env.local, then:
npm run ingest
```

## Deploy notes

- Ingestion runs in GitHub Actions (secrets: `TM_API_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`), not Vercel cron — avoids the serverless timeout wall.
- The site (T9) deploys to Vercel and reads from Supabase with ISR caching.
