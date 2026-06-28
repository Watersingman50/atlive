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
