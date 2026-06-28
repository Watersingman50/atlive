import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canonicalKey, type CanonicalEvent } from "./types.js";

// Idempotent two-step upsert (T3):
//
//   for each normalized event:
//     1. upsert events ON CONFLICT (canonical_key)   ← dedup; refresh last_seen_at
//     2. upsert event_sources ON CONFLICT (source, source_event_id)  ← provenance
//
// Re-running the cron never duplicates rows.

export function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // lets ingest run in --dry-run before Supabase exists
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface UpsertResult {
  events: number;
  sources: number;
}

export async function upsertEvents(
  db: SupabaseClient,
  events: CanonicalEvent[],
): Promise<UpsertResult> {
  let eventCount = 0;
  let sourceCount = 0;

  for (const e of events) {
    const key = canonicalKey(e);

    // 1. canonical event (merge: COALESCE keeps existing non-null on conflict)
    const { data: ev, error: evErr } = await db
      .from("events")
      .upsert(
        {
          canonical_key: key,
          title: e.title,
          artist: e.artist,
          venue_name: e.venueName,
          event_date: e.eventDate,
          starts_at: e.startsAt,
          url: e.url,
          image_url: e.imageUrl,
          min_price: e.minPrice,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "canonical_key" },
      )
      .select("id")
      .single();
    if (evErr) throw new Error(`events upsert failed (${key}): ${evErr.message}`);
    eventCount++;

    // 2. provenance row
    const { error: srcErr } = await db.from("event_sources").upsert(
      {
        event_id: ev.id,
        source: e.source,
        source_event_id: e.sourceEventId,
        source_url: e.url,
        raw: e.raw,
        seen_at: new Date().toISOString(),
      },
      { onConflict: "source,source_event_id" },
    );
    if (srcErr) throw new Error(`event_sources upsert failed: ${srcErr.message}`);
    sourceCount++;
  }

  return { events: eventCount, sources: sourceCount };
}
