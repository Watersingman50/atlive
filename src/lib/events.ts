import { createClient } from "@supabase/supabase-js";

// Read-side data access for the homepage.
//
// SINGLE join query (no N+1): one PostgREST request pulls each canonical event
// with its embedded event_sources rows. Runs server-side only (service-role
// key never reaches the browser). Cached via ISR (revalidate) on the page.
// Fetches a 14-day window so the client can filter this-week vs next-week.

export interface UpcomingEvent {
  id: string;
  title: string;
  artist: string | null;
  venue_name: string | null;
  genre: string | null;
  event_date: string | null;
  starts_at: string | null;
  url: string | null;
  image_url: string | null;
  min_price: number | null;
  blurb: string | null;
  rank_score: number | null;
  event_sources: { source: string }[];
}

export interface UpcomingResult {
  events: UpcomingEvent[];
  error: string | null;
  /** Most recent ingest time (max last_seen_at) — drives the freshness banner. */
  lastIngest: string | null;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function getUpcomingEvents(days = 14): Promise<UpcomingResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { events: [], error: "Supabase env not configured", lastIngest: null };
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const today = new Date();
  const end = new Date(Date.now() + days * 86_400_000);

  const { data, error } = await db
    .from("events")
    .select(
      "id,title,artist,venue_name,genre,event_date,starts_at,url,image_url,min_price,blurb,rank_score,last_seen_at,event_sources(source)",
    )
    .gte("event_date", isoDate(today))
    .lte("event_date", isoDate(end))
    .order("rank_score", { ascending: false, nullsFirst: false })
    .order("event_date", { ascending: true });

  const rows = (data as (UpcomingEvent & { last_seen_at?: string })[] | null) ?? [];
  const lastIngest =
    rows.length > 0
      ? rows.reduce<string | null>((max, r) => (r.last_seen_at && (!max || r.last_seen_at > max) ? r.last_seen_at : max), null)
      : null;

  return {
    events: rows,
    error: error?.message ?? null,
    lastIngest,
  };
}
