-- Newsletter subscribers (task 2). ADDITIVE migration — no drops, safe to run
-- against the live DB without touching events/event_sources data.
--
-- Double opt-in: signup inserts status='pending' + a token; the confirm link
-- flips to 'confirmed'; the unsubscribe link flips to 'unsubscribed'. The
-- weekly digest sends only to 'confirmed'. One token per subscriber serves both
-- the confirm and unsubscribe links (delivered only to that subscriber's inbox).

create extension if not exists pgcrypto;  -- gen_random_uuid()

create table if not exists public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,          -- stored lowercased by the app
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'unsubscribed')),
  token           uuid not null default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);

create index if not exists subscribers_token_idx on public.subscribers (token);
create index if not exists subscribers_status_idx on public.subscribers (status);

-- Defense-in-depth: RLS on, no policies. Only trusted server-side code
-- (service-role key, in API routes / the digest job) touches this table.
alter table public.subscribers enable row level security;
