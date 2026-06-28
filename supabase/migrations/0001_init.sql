-- ATLive schema: canonical events + per-source provenance.
--
-- DATA MODEL
-- ─────────────────────────────────────────────────────────────
--   one real show  ─────────────┐
--                               ▼
--   ┌───────────────────────────────────────┐
--   │ events (canonical, deduped)            │   one row per real show
--   │  canonical_key  UNIQUE  ◄── dedup key  │   (normalized artist|date|venue)
--   │  title, artist, venue_name, starts_at  │
--   │  url, image_url, min_price             │
--   │  blurb, rank_score  (filled by LLM)    │
--   │  first_seen_at, last_seen_at           │
--   └───────────────┬───────────────────────┘
--                   │ 1
--                   │
--                   │ N
--   ┌───────────────▼───────────────────────┐
--   │ event_sources (provenance)             │   one row per (source, source_event_id)
--   │  event_id  FK ─► events.id             │   "seen in Ticketmaster AND Variety site"
--   │  source ('ticketmaster' | '529' | ...) │
--   │  source_event_id  ◄── idempotent key   │
--   │  source_url, raw (jsonb)               │
--   │  UNIQUE (source, source_event_id)      │
--   └────────────────────────────────────────┘
--
-- IDEMPOTENCY: ingest upserts events ON CONFLICT (canonical_key) and
-- event_sources ON CONFLICT (source, source_event_id). Re-running the cron
-- never duplicates — it refreshes last_seen_at and merges newer fields.

create extension if not exists pgcrypto;  -- gen_random_uuid()

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,           -- normalized: artist|YYYY-MM-DD|venue
  title         text not null,
  artist        text,
  venue_name    text,
  genre         text,                           -- e.g. Rock, Pop, Hip-Hop (from Ticketmaster classifications)
  city          text default 'Atlanta',
  event_date    date,                           -- local show date (for "this week" queries)
  starts_at     timestamptz,                    -- full local start, when known
  url           text,                           -- canonical ticket/info link
  image_url     text,
  min_price     numeric(10,2),
  blurb         text,                           -- LLM-generated, filled at ingest (T8)
  rank_score    numeric,                        -- LLM/popularity rank (T8); null = use date sort
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists events_event_date_idx on public.events (event_date);

create table if not exists public.event_sources (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  source          text not null,                -- 'ticketmaster' | '529' | 'variety'
  source_event_id text not null,                -- external id (stable per source)
  source_url      text,
  raw             jsonb,                         -- original payload, for debugging/eval
  seen_at         timestamptz not null default now(),
  unique (source, source_event_id)
);

create index if not exists event_sources_event_id_idx on public.event_sources (event_id);

-- keep events.updated_at fresh on any change
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

-- Defense-in-depth: enable RLS with NO policies. The app and ingest use the
-- service-role key (which bypasses RLS), so they're unaffected; anon/authenticated
-- roles get zero rows. Nothing reads this DB except trusted server-side code.
alter table public.events enable row level security;
alter table public.event_sources enable row level security;

-- Ingest run history (powers the /pipeline status page). Each ingest writes one row.
create table if not exists public.ingest_runs (
  id          uuid primary key default gen_random_uuid(),
  ran_at      timestamptz not null default now(),
  status      text not null,                    -- 'success' | 'error'
  sources     jsonb,                            -- {ticketmaster: 26, "529": 27, variety: 58}
  created     int,                              -- new canonical events
  merged      int,                              -- fuzzy cross-source merges
  source_rows int,                              -- event_sources upserted
  blurbs      int,                              -- LLM blurbs filled this run
  error       text
);
alter table public.ingest_runs enable row level security;

-- Single-call aggregate for the /pipeline page (read via service-role).
create or replace function public.pipeline_stats() returns jsonb language sql stable as $func$
  select jsonb_build_object(
    'events', (select count(*) from public.events),
    'source_rows', (select count(*) from public.event_sources),
    'cross_source_merges', (
      select count(*) from (
        select event_id from public.event_sources group by event_id having count(distinct source) > 1
      ) t),
    'by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'count', n, 'last_seen', last_seen) order by n desc), '[]'::jsonb)
      from (select source, count(*) n, max(seen_at) last_seen from public.event_sources group by source) s),
    'runs', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.ran_at desc), '[]'::jsonb)
      from (select ran_at, status, sources, created, merged, source_rows, blurbs from public.ingest_runs order by ran_at desc limit 10) r)
  );
$func$;
