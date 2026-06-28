import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canonicalKey, type CanonicalEvent } from "./types.js";
import { sameEvent } from "./dedup.js";

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
  created: number;
  merged: number;
  sources: number;
}

export interface EventNeedingBlurb {
  id: string;
  title: string;
  artist: string | null;
  venue_name: string | null;
}

/** Upcoming events with no blurb yet (generate-once; bounded to control cost). */
export async function getEventsNeedingBlurbs(
  db: SupabaseClient,
  limit = 40,
): Promise<EventNeedingBlurb[]> {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db
    .from("events")
    .select("id,title,artist,venue_name")
    .is("blurb", null)
    .gte("event_date", today)
    .lte("event_date", end)
    .order("event_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`getEventsNeedingBlurbs failed: ${error.message}`);
  return (data as EventNeedingBlurb[] | null) ?? [];
}

export async function setBlurb(db: SupabaseClient, id: string, blurb: string): Promise<void> {
  const { error } = await db.from("events").update({ blurb }).eq("id", id);
  if (error) throw new Error(`setBlurb failed (${id}): ${error.message}`);
}

export interface IngestRun {
  status: "success" | "error";
  sources: Record<string, number>;
  created: number;
  merged: number;
  sourceRows: number;
  blurbs: number;
  error?: string | null;
}

/** Record one ingest run (powers the /pipeline status page). Best-effort. */
export async function recordIngestRun(db: SupabaseClient, run: IngestRun): Promise<void> {
  const { error } = await db.from("ingest_runs").insert({
    status: run.status,
    sources: run.sources,
    created: run.created,
    merged: run.merged,
    source_rows: run.sourceRows,
    blurbs: run.blurbs,
    error: run.error ?? null,
  });
  if (error) console.error(`[ingest_runs] record failed: ${error.message}`);
}

interface ExistingEvent {
  id: string;
  artist: string | null;
  venueName: string | null;
  eventDate: string | null;
}

export async function upsertEvents(
  db: SupabaseClient,
  events: CanonicalEvent[],
): Promise<UpsertResult> {
  // Preload existing canonical events so we can match in memory: exact by
  // canonical_key, then fuzzy (sameEvent) for cross-source name variants.
  // The table is small at this scale; bound by date range for larger volumes.
  const { data: existing, error: loadErr } = await db
    .from("events")
    .select("id,canonical_key,artist,venue_name,event_date");
  if (loadErr) throw new Error(`preload events failed: ${loadErr.message}`);

  const byKey = new Map<string, string>(); // canonical_key -> id
  const byDate = new Map<string, ExistingEvent[]>(); // event_date -> candidates
  for (const r of existing ?? []) {
    byKey.set(r.canonical_key, r.id);
    if (!r.event_date) continue;
    const row: ExistingEvent = { id: r.id, artist: r.artist, venueName: r.venue_name, eventDate: r.event_date };
    (byDate.get(r.event_date) ?? byDate.set(r.event_date, []).get(r.event_date)!).push(row);
  }

  let created = 0;
  let merged = 0;
  let sourceCount = 0;

  for (const e of events) {
    const key = canonicalKey(e);
    const now = new Date().toISOString();
    let id = byKey.get(key); // 1. exact key

    if (!id && e.eventDate) {
      // 2. fuzzy fallback: a same-date event whose artist+venue are similar
      const match = (byDate.get(e.eventDate) ?? []).find((c) =>
        sameEvent({ artist: e.artist, venueName: e.venueName, eventDate: e.eventDate }, c),
      );
      if (match) {
        id = match.id;
        merged++;
      }
    }

    if (id) {
      await db.from("events").update({ last_seen_at: now }).eq("id", id);
    } else {
      // 3. new canonical event
      const { data: ins, error: insErr } = await db
        .from("events")
        .insert({
          canonical_key: key,
          title: e.title,
          artist: e.artist,
          venue_name: e.venueName,
          genre: e.genre,
          event_date: e.eventDate,
          starts_at: e.startsAt,
          url: e.url,
          image_url: e.imageUrl,
          min_price: e.minPrice,
          last_seen_at: now,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`events insert failed (${key}): ${insErr.message}`);
      id = ins.id as string;
      created++;
      byKey.set(key, id);
      if (e.eventDate) {
        const row: ExistingEvent = { id, artist: e.artist, venueName: e.venueName, eventDate: e.eventDate };
        (byDate.get(e.eventDate) ?? byDate.set(e.eventDate, []).get(e.eventDate)!).push(row);
      }
    }

    // provenance row (idempotent on source + source_event_id)
    if (!id) throw new Error("unreachable: event id not resolved");
    const { error: srcErr } = await db.from("event_sources").upsert(
      {
        event_id: id,
        source: e.source,
        source_event_id: e.sourceEventId,
        source_url: e.url,
        raw: e.raw,
        seen_at: now,
      },
      { onConflict: "source,source_event_id" },
    );
    if (srcErr) throw new Error(`event_sources upsert failed: ${srcErr.message}`);
    sourceCount++;
  }

  return { created, merged, sources: sourceCount };
}
